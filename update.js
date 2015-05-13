"use strict";

var version = require('./package.json').version,
    name = require('./package.json').name;

var https = require('https');

https.get('https://neosoft-updates.s3.amazonaws.com/zupdate/' + name + '/' + version + '.xml', function(res) {

    console.log('Checking for updates');

    var updateXML = '';

    res.on('data', function(d) {
        updateXML += d;
    });

    res.on('end', function() {
        if (res.statusCode === 200) {
            require('xml2js').parseString(updateXML, processUpdateInfo);
        } else {
            console.error('Failed to download update info:', res.statusCode);
            require('./server.js');
        }
    });

}).on('error', function(e) {
    console.error(e);
    require('./server.js');
});

function processUpdateInfo(err, info)
{
    if (err) {
        console.error('Failed to parse XML:', err);
        require('./server.js');
        return false;
    }

    if (!info.updates) {
        console.log('Up to date');
        require('./server.js');
        return false;
    }

    var update = info.updates.update[0].patch[0].$;
    update.size = parseInt(update.size, 10);

    var crypto = require('crypto');

    var zip = new Buffer(update.size);

    var shasum = crypto.createHash(update.hashFunction);

    https.get(update.URL, function(res) {

        console.log('Downloading update');

        var downloadedBytes = 0;

        res.on('data', function(d) {
            shasum.update(d);
            d.copy(zip, downloadedBytes);
            downloadedBytes += d.length;
        });

        res.on('end', function() {

            if (downloadedBytes !== update.size) {
                console.error('Download incomplete');
                require('./server.js');
                return;
            }

            console.log('Download complete');

            var checksum = shasum.digest('hex');

            if (checksum !== update.hashValue) {
                console.error('Checksum mismatch');
                require('./server.js');
                return;
            }

            console.log('Applying update');

            var AdmZip = require('adm-zip');

            var archive = new AdmZip(zip);

            archive.extractAllTo('.', true);

            console.log('Update complete');

            require('./server.js');
        });

    }).on('error', function(e) {
        console.error(e);
        require('./server.js');
    });
}

process.on('uncaughtException', function (err) {
    console.log('uncaughtException:' + err);
    console.log(err.stack);
});
