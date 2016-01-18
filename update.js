"use strict";

module.exports = function (log, cb) {
 
    function checkUpdates()
    {
        var version = require('./package.json').version;
    
        var https = require('https');
    
        https.get('https://neosoft-updates.s3.amazonaws.com/zupdate/NHomeServer/' + version + '.xml', function(res) {
    
            log.info('Checking for updates');
    
            var updateXML = '';
    
            res.on('data', function(d) {
                updateXML += d;
            });
    
            res.on('end', function() {
                if (res.statusCode === 200) {
                    require('xml2js').parseString(updateXML, processUpdateInfo);
                } else {
                    log.error('Failed to download update info:', res.statusCode);
                    loaded();
                }
            });
    
        }).on('error', function(e) {
            log.error(e);
            loaded();
        });
    }
    
    function processUpdateInfo(err, info)
    {
        if (err) {
            log.error('Failed to parse XML:', err);
            loaded();
            return false;
        }

        if (!info.updates) {
            log.info('Up to date');
            loaded();
            return false;
        }

        var update = info.updates.update[0].patch[0].$;
        update.size = parseInt(update.size, 10);

        var crypto = require('crypto');

        var zip = new Buffer(update.size);

        var shasum = crypto.createHash(update.hashFunction);

        https.get(update.URL, function(res) {

            log.info('Downloading update');

            var downloadedBytes = 0;

            res.on('data', function(d) {
                shasum.update(d);
                d.copy(zip, downloadedBytes);
                downloadedBytes += d.length;
            });

            res.on('end', function() {

                if (downloadedBytes !== update.size) {
                    log.error('Download incomplete');
                    loaded();
                    return;
                }

                log.info('Download complete');

                var checksum = shasum.digest('hex');

                if (checksum !== update.hashValue) {
                    log.error('Checksum mismatch');
                    loaded();
                    return;
                }

                log.info('Applying update');

                var AdmZip = require('adm-zip');

                var archive = new AdmZip(zip);

                archive.extractAllTo('.', true);

                log.info('Update complete');

                loaded();
            });

        }).on('error', function(e) {
            log.error(e);
            loaded();
        });
    }

    function reSpawn(pid)
    {
        try {
            process.kill(pid, 0);
            setTimeout(reSpawn, 1000, pid);
        } catch (e){
            checkUpdates();
        }
    }
    
    function loaded()
    {
        if (process.argv[2]) {
            require('child_process').spawn('nhome', [], { detached: true });
        } else {
            require('./lib/main.js')(log, cb);
        }
    }

    if (process.argv[2]) {
        process.kill(process.argv[2]);
        reSpawn(process.argv[2]);
    } else {
        checkUpdates();        
    }
};

if (!module.parent) {
    var dummylog;
    if (process.argv[2]) {
        var updatelog = require('fs').createWriteStream('update.log');
        dummylog = require('./lib/logger.js')({loglevel: 'info', nocolor: true}, updatelog);
    } else {
        dummylog = require('./lib/logger.js')({loglevel: 'info', nocolor: false}, process.stdout);
    }
    module.exports(dummylog);
}

