"use strict";

var https = require('https');

var updater = {

    update: function (cb) {

        updater.get(function (updateInfo) {
            if (updateInfo) {
                updater.applyUpdate(updateInfo, cb);
            } else {
                cb();
            }
        });
    },

    get: function (cb) {

        var version = require('../package.json').version;

        https.get('https://eynio.s3.amazonaws.com/check/NHomeServer/' + version + '.xml', function(res) {

            console.log('Checking for updates');

            var updateXML = '';

            res.on('data', function(d) {
                updateXML += d;
            });

            res.on('end', function() {
                if (res.statusCode === 200) {

                    require('xml2js').parseString(updateXML, function (err, info) {

                        if (err) {
                            console.log('Failed to parse XML:', err);
                            return cb(false);
                        }

                        if (info.updates) {
                            return cb(info.updates.update[0].patch[0].$);
                        } else {
                            return cb(false);
                        }
                    });

                } else {
                    console.log('Failed to download update info:', res.statusCode);
                    cb(false);
                }
            });

        }).on('error', function(e) {
            console.log(e);
            cb(false);
        });
    },

    applyUpdate: function (update, cb) {

        update.size = parseInt(update.size, 10);

        var crypto = require('crypto');

        var zip = Buffer.alloc(update.size);

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
                    return cb();
                }

                console.log('Download complete');

                var checksum = shasum.digest('hex');

                if (checksum !== update.hashValue) {
                    console.log('Checksum mismatch');
                    return cb();
                }

                console.log('Applying update');

                var AdmZip = require('adm-zip');

                var archive = new AdmZip(zip);

                archive.extractAllTo('.', true);

                console.log('Update complete');

                return cb();
            });

        }).on('error', function(e) {
            console.log(e);
            return cb();
        });
    }
};

module.exports = updater;

