"use strict";

var https = require('https');

function checkUpdates()
{
    var version = require('./package.json').version;

    https.get('https://nhome.s3.amazonaws.com/zupdate/NHomeServer/' + version + '.xml', function(res) {

        console.log('Checking for updates');

        var updateXML = '';

        res.on('data', function(d) {
            updateXML += d;
        });

        res.on('end', function() {
            if (res.statusCode === 200) {
                require('xml2js').parseString(updateXML, processUpdateInfo);
            } else {
                console.log('Failed to download update info:', res.statusCode);
                loaded();
            }
        });

    }).on('error', function(e) {
        console.log(e);
        loaded();
    });
}

function processUpdateInfo(err, info)
{
    if (err) {
        console.log('Failed to parse XML:', err);
        loaded();
        return false;
    }

    if (!info.updates) {
        console.log('Up to date');
        loaded();
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
                console.log('Download incomplete');
                loaded();
                return;
            }

            console.log('Download complete');

            var checksum = shasum.digest('hex');

            if (checksum !== update.hashValue) {
                console.log('Checksum mismatch');
                loaded();
                return;
            }

            console.log('Applying update');

            var AdmZip = require('adm-zip');

            var archive = new AdmZip(zip);

            archive.extractAllTo('.', true);

            console.log('Update complete');

            loaded();
        });

    }).on('error', function(e) {
        console.log(e);
        loaded();
    });
}

function loaded()
{
    delete require.cache[require.resolve('./package.json')];
    require('./lib/main.js')();
}

checkUpdates();

