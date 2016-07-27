"use strict";

var tcpp = require('tcp-ping');
var stream = require('stream');
var util = require('util');

var conn, logger;

var snapshotCache = {};

var cfg = require('../configuration.js');

var streamcore;

var ports_by_protocol = {
    'http:' : 80,
    'https:': 443,
    'rtsp:' : 554
};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    streamcore = require('../streaming/core.js');

    if (!streamcore.initialised) {
        streamcore(logger);
    }

    conn.on('startStreaming', function (command) {
        startStreaming.apply(command, command.args);
    });

    conn.on('stopStreaming', function (command) {
        stopStreaming.apply(command, command.args);
    });

    conn.on('getLiveThumbnail', function (command) {
        getLiveThumbnail.apply(command, command.args);
    });

    conn.on('getCachedThumbnail', function (command) {
        getCachedThumbnail.apply(command, command.args);
    });

    conn.on('testStreamURL', function (command) {
        testStreamURL.apply(command, command.args);
    });

    streamcore.ffmpeg(function() {
        updateCache();
        setInterval(updateCache, 5 * 60 * 1000);
        preConnect();
    });
};

function updateCache()
{
    logger.debug('Updating camera thumbnails');

    var cameras = cfg.get('cameras', {});

    for (var cameraid in cameras) {
        updateCachedImage(cameraid);
    }
}

function updateCachedImage(id)
{
    getLiveThumbnail(id, function (image) {
        if (image) {
            logger.debug('Updated thumbnail for', id);
            snapshotCache[id] = image;
        }
    });
}

function preConnect()
{
    var cameras = cfg.get('cameras', {});

    var options = { width: -1, height: -1, framerate: -1 };

    var cam;

    for (var cameraid in cameras) {
        cam = cameras[cameraid];
        if (cam.preconnect && !(cam.motion_alarm || cam.motion_recording || cam.continuous_recording)) {
            var destination = nullStream();
            var key = cameraKey(cameraid, options);
            streamcore.runStream(cameraid, cam, options, destination, key);
        }
    }
}

function nullStream()
{
    var Writable = stream.Writable;
    util.inherits(NullStreamer, Writable);

    function NullStreamer(opt) {
        Writable.call(this, opt);
    }

    NullStreamer.prototype._write = function(chunk, encoding, next) {
        setImmediate(next);
    };

    var writable = new NullStreamer({ objectMode: true });

    return writable;
}

function startStreaming(cameraid, options, cb)
{
    logger.debug('Creating stream from ' + cameraid);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var destination = getSocketIOStream(cameraid, options);

    var key = cameraKey(cameraid, options);

    if (camera.screencapture || camera.local) {

        streamcore.runStream(cameraid, camera, options, destination, key);

        if (typeof cb === 'function') {
            cb(true);
        }

        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.probe(parts.hostname, port, function (err, available) {

        if (!available) {
            logger.error('Camera', camera.name, 'at', parts.hostname + ':' + port, 'is not available');
            logger.debug('Probe error', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        streamcore.runStream(cameraid, camera, options, destination, key);

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function stopStreaming(cameraid, options)
{
    var key = cameraKey(cameraid, options);

    streamcore.stopStreaming(key);
}

function getLiveThumbnail(cameraid, cb)
{
    logger.debug('Creating snapshot from ' + cameraid);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (camera.screencapture || camera.local) {
        streamcore.getThumbnail(cameraid, cb);
        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.ping({address: parts.hostname, port: port, attempts: 1, timeout: 2000 }, function (err, data) {

        if (data.min === undefined) {
            logger.debug('Camera', camera.name, 'at', parts.hostname + ':' + port, 'not responding to tcp connection');
            logger.debug('Probe error', err);
            if (typeof cb === 'function') {
                cb(null);
            }
            return;
        }

        streamcore.getThumbnail(cameraid, cb);
    });
}

function getCachedThumbnail(cameraid, cb)
{
    logger.debug('Retrieving cached snapshot from ' + cameraid);

    if (snapshotCache[cameraid]) {
        cb(snapshotCache[cameraid]);
    } else {
        getLiveThumbnail(cameraid, function (image) {
            if (image) {
                snapshotCache[cameraid] = image;
            }
            cb(image);
        });
    }
}

function testStreamURL(url, cb)
{
    var parts = require('url').parse(url);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.ping({address: parts.hostname, port: port, attempts: 1, timeout: 2000 }, function (err, data) {

        if (err) {
            logger.debug(err);
        }

        if (typeof cb === 'function') {
            cb(data.min !== undefined);
        }
    });
}

function getSocketIOStream(cameraid, options)
{
    var Writable = stream.Writable;
    util.inherits(Streamer, Writable);

    function Streamer(opt) {
        Writable.call(this, opt);
    }

    Streamer.prototype._write = function(chunk, encoding, next) {

        if (!conn.connected) {
            return next();
        }

        var frame = {
            camera: cameraid,
            options: options,
            image: chunk
        };

        if (options.local) {
            conn.local('cameraFrame', frame);
        } else if (['mpeg1', 'vp8', 'vp9'].indexOf(options.encoder) !== -1) {
            conn.send('cameraFrame', frame);
        } else {
            conn.sendVolatile('cameraFrame', frame);
        }

        next();
    };

    var writable = new Streamer({ objectMode: true });

    return writable;
}

function cameraKey(cameraid, options)
{
    return [cameraid, options.width, options.height, options.framerate, options.encoder || 'jpeg', options.local ? 'local' : 'remote'].join('-');
}

