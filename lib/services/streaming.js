"use strict";

var tcpp = require('tcp-ping');
var stream = require('stream');
var util = require('util');

var conn, logger;

var snapshotCache = {};

var cfg = require('../configuration.js');

var streamcore = require('../streaming/core.js');

var ports_by_protocol = {
    'http:' : 80,
    'https:': 443,
    'rtsp:' : 554
};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

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
    try {
        getLiveThumbnail(id, function (image) {
            if (image) {
                logger.debug('Updated thumbnail for', id);
                snapshotCache[id] = image;
            }
        });
    } catch (e) {
        logger.error('Error creating cached camera thumbnail for', id, e);
    }
}

function preConnect()
{
    var cameras = cfg.get('cameras', {});

    var options_jpeg = { width: -1, height: -1, framerate: -1, encoder: 'jpeg' };
    //var options_mp4 = { width: -1, height: -1, framerate: -1, encoder: 'mp4-mse' };

    var cam;

    for (var cameraid in cameras) {
        cam = cameras[cameraid];
        if (cam.preconnect && !(cam.motion_alarm || cam.motion_recording)) {
            var destination_jpeg = nullStream();
            //var destination_mp4 = nullStream();
            var key_jpeg = cameraKey(cameraid, options_jpeg) + '-preconnect';
            //var key_mp4 = cameraKey(cameraid, options_mp4) + '-preconnect';
            tryStream(cameraid, cam, options_jpeg, destination_jpeg, key_jpeg);
            //tryStream(cameraid, cam, options_mp4, destination_mp4, key_mp4);
        }
        updateCachedImage(cameraid);
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

    tryStream(cameraid, camera, options, destination, key, cb);
}

function tryStream(cameraid, camera, options, destination, key, cb)
{
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
        streamcore.getThumbnail(camera, cb);
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

        streamcore.getThumbnail(camera, cb);
    });
}

function getCachedThumbnail(cameraid, cb)
{
    logger.debug('Retrieving cached snapshot from ' + cameraid);

    if (typeof cb === 'function') {
        cb(snapshotCache[cameraid]);
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

        if (options.base64) {
            if (options.encoder === 'vp8-mse' || options.encoder === 'mp4-mse') {
                frame.image.metadata = frame.image.metadata.toString('base64');
                frame.image.cluster = frame.image.cluster.toString('base64');
            } else {
                frame.image = frame.image.toString('base64');
            }
        }

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
    return [
        cameraid,
        options.width,
        options.height,
        options.framerate,
        options.encoder || 'jpeg',
        options.base64 ? 'b64' : 'bin'
    ].join('-');
}

