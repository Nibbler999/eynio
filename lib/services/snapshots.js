"use strict";

var fs = require('fs');

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var streamcore = require('../streaming/core.js');

var conn, logger;

var snapshots = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Snapshots'});

    snapshots = cfg.snapshots.get('snapshots', {});

    conn.on('takeSnapshot', function (command) {
        takeSnapshot.apply(command, command.args);
    });

    conn.on('getSnapshots', function (command) {
        getSnapshots.apply(command, command.args);
    });

    conn.on('getSomeSnapshots', function (command) {
        getSomeSnapshots.apply(command, command.args);
    });

    conn.on('deleteSnapshot', function (command) {
        deleteSnapshot.apply(command, command.args);
    });

    conn.on('getSnapshot', function (command) {
        getSnapshot.apply(command, command.args);
    });

    conn.on('getSnapshotThumbnail', function (command) {
        getSnapshotThumbnail.apply(command, command.args);
    });
};

function takeSnapshot(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});
    var camera = cameras[cameraid];

    streamcore.makeSnapshot(camera, function (image, thumbnail) {

        if (!image) {

            if (typeof cb === 'function') {
                cb(false);
            }

            return false;
        }

        var dir = cfg.getSnapshotDirectory();

        var snapshotid = require('uuid/v4')();

        var filename = require('path').join(dir, snapshotid + '.jpeg');

        fs.writeFile(filename, image, function (err) {

            if (err) {

                logger.error(err);

                if (typeof cb === 'function') {
                    cb(false);
                }

                return false;
            }

            snapshots[snapshotid] = {
                cameraid: cameraid,
                datetime: +new Date(),
                filesize: Buffer.byteLength(image)
            };

            cfg.snapshots.set('snapshots', snapshots);

            var thumb_filename = require('path').join(dir, 'thumb_' + snapshotid + '.jpeg');

            fs.writeFile(thumb_filename, thumbnail || image, function (err) {

                if (err) {
                    logger.error(err);
                }

                var s = {
                    id: snapshotid,
                    cameraid: snapshots[snapshotid].cameraid,
                    datetime: snapshots[snapshotid].datetime,
                    filesize: snapshots[snapshotid].filesize
                };

                if (typeof cb === 'function') {
                    cb(s);
                }

                conn.broadcast('snapshotAdded', s);
            });
        });
    });
}

function getSnapshots(cb)
{
    var result = hash_to_array(snapshots);

    if (typeof cb === 'function') {
        cb(result);
    }
}

function getSomeSnapshots(filter, cb)
{
    var result = hash_to_array(snapshots);

    result = result.filter(function (snapshot) {
        return !filter.cameraid || filter.cameraid === snapshot.cameraid;
    }).filter(function (snapshot) {
        return !filter.start || snapshot.datetime >= filter.start;
    }).filter(function (snapshot) {
        return !filter.end || snapshot.datetime <= filter.end;
    });

    if (filter.descending) {
        result = result.sort(function (a, b) {
            return a.datetime > b.datetime ? -1 : 1;
        });
    }

    if (filter.limit > 0) {
        result = result.slice(0, filter.limit);
    }

    if (typeof cb === 'function') {
        cb(result);
    }
}

function deleteSnapshot(snapshotid, cb)
{
    if (!snapshots.hasOwnProperty(snapshotid)) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    delete snapshots[snapshotid];

    cfg.snapshots.set('snapshots', snapshots);

    if (/^[a-f0-9-]+$/.test(snapshotid)) {

        var dir = cfg.getSnapshotDirectory();

        var filename = require('path').join(dir, snapshotid + '.jpeg');
        var thumb_filename = require('path').join(dir, 'thumb_' + snapshotid + '.jpeg');

        fs.unlink(filename, function (err) {
            if (err) {
                logger.warn('Failed to delete snapshot at ' + filename, err);
            }
        });

        fs.unlink(thumb_filename, function (err) {
            if (err) {
                logger.warn('Failed to delete snapshot thumbnail at ' + thumb_filename, err);
            }
        });

        if (typeof cb === 'function') {
            cb(true);
        }

        conn.broadcast('snapshotDeleted', snapshotid);

    } else {

        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

function getSnapshot(snapshotid, cb)
{
    var dir = cfg.getSnapshotDirectory();

    var filename = require('path').join(dir, snapshotid + '.jpeg');

    fs.readFile(filename, function (err, data) {

        if (err) {

            logger.error(err);

            if (typeof cb === 'function') {
                cb(null);
            }

            return false;
        }

        if (typeof cb === 'function') {
            cb(data);
        }
    });
}

function getSnapshotThumbnail(snapshotid, cb)
{
    var dir = cfg.getSnapshotDirectory();

    var filename = require('path').join(dir, 'thumb_' + snapshotid + '.jpeg');

    fs.readFile(filename, function (err, data) {

        if (err) {

            logger.error(err);

            if (typeof cb === 'function') {
                cb(null);
            }

            return false;
        }

        if (typeof cb === 'function') {
            cb(data);
        }
    });
}

