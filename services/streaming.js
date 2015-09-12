"use strict";

var stream = require('stream');
var util = require('util');
var tcpp = require('tcp-ping');

var conn, logger, ffmpeg;

var sources = {}, destinations = {}, scalers = {}, pipes = {};

var snapshotCache = {};

var cfg = require('../configuration.js');

var ports_by_protocol = {
    'http:' : 80,
    'https:': 443,
    'rtsp:' : 554
};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    ffmpeg = require('./streaming/ffmpeg.js')(logger);

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

    conn.on('disconnect', function () {
        stopStreamingAll();
    });

    ffmpeg.check(updateCache);

    setInterval(updateCache, 5 * 60 * 1000);
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

function startStreaming(cameraid, options, cb)
{
    logger.debug('Creating stream from ' + cameraid);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        if (cb) cb();
        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.probe(parts.hostname, port, function (err, available) {

        if (!available) {
            logger.error('Camera', camera.name, 'at', parts.hostname + ':' + port, 'is not available');
            logger.debug('Probe error', err);
            if (cb) cb(false);
            return;
        }

        runStream(cameraid, camera, options);

        if (cb) cb(true);
    });
}

function runStream(cameraid, camera, options)
{
    var pipeSource = function (source) {

        var key = cameraKey(cameraid, options);

        var sio = destinations[key] = getSocketIOStream(cameraid, options);

        sio.on('pipe', function () {
            if (!pipes[cameraid]) pipes[cameraid] = 0;
            pipes[cameraid]++;
        });

        sio.on('unpipe', function () {
            if (--pipes[cameraid] === 0) {
                sources[cameraid][options.framerate].end();
            }
        });

        if (ffmpeg.available && (options.width > 0 || options.height > 0 || camera.rotate)) {

            var scaler = scalers[key] = ffmpeg.getScaler(options, camera.rotate);

            source.pipe(scaler).pipe(sio);

        } else {
            source.pipe(sio);
        }
    };

    if (sources[cameraid] && sources[cameraid][options.framerate] && sources[cameraid][options.framerate].readable) {
        pipeSource(sources[cameraid][options.framerate]);
    } else {

        getSourceStream(camera, options, function (source) {

            if (!source) {
                return false;
            }

            source.setMaxListeners(100);

            if (!sources[cameraid]) {
                sources[cameraid] = {};
            }

            sources[cameraid][options.framerate] = source;

            pipeSource(source);
        });
    }
}

function stopStreaming(cameraid, options)
{
    var key = cameraKey(cameraid, options);

    if (scalers[key]) {
        scalers[key].unpipe(destinations[key]);
        sources[cameraid][options.framerate].unpipe(scalers[key]);
    } else if (sources[cameraid] && sources[cameraid][options.framerate]) {
        sources[cameraid][options.framerate].unpipe(destinations[key]);
    }
}

function stopStreamingAll()
{
    for (var d in destinations) {
        if (d.indexOf('remote') !== -1) {
            destinations[d].end();
        }
    }
}

function getSourceStream(camera, options, cb)
{
    var method;

    if (camera.mjpeg) {
        method = require('./streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('./streaming/rtsp.js');
    } else if (camera.snapshot) {
        method = require('./streaming/snapshot.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    method.stream(logger, camera, options, cb);
}

function getLiveThumbnail(cameraid, cb)
{
    logger.debug('Creating snapshot from ' + cameraid);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        if (cb) cb();
        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.ping({address: parts.hostname, port: port, attempts: 1, timeout: 2000 }, function (err, data) {

        if (data.min === undefined) {
            logger.debug('Camera', camera.name, 'at', parts.hostname + ':' + port, 'not responding to tcp connection');
            logger.debug('Probe error', err);
            if (cb) cb(false);
            return;
        }

        getThumbnail(cameraid, cb);
    });
}

function saveImageDimensions(id, image)
{
    var size = require('jpeg-size');

    var s = size(image);

    if (s) {
        s.id = id;
        conn.emit('updateCamera', {args: [s]});
    }
}

function getThumbnail(id, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[id];

    if (!camera) {
        return false;
    }

    getThumbnailImage(id, function (image) {

        if (!image) {
            return false;
        }

        saveImageDimensions(id, image);

        var options = {
            width: -1,
            height: 120
        };

        if (ffmpeg.available && (options.width > 0 || options.height > 0 || camera.rotate)) {

            var scaler = ffmpeg.getScaler(options, camera.rotate);

            scaler.once('data', function (thumbnail) {
                cb(thumbnail);
            });

            scaler.write(image);
            scaler.end();

        } else {
            cb(image);
        }
    });
}

function getThumbnailImage(id, cb)
{
    var method;

    var cameras = cfg.get('cameras', {});

    var camera = cameras[id];

    if (!camera) {
        logger.debug('Unknown camera', id);
        if (cb) cb();
        return;
    }

    if (camera.snapshot) {
        method = require('./streaming/snapshot.js');
    } else if (camera.mjpeg) {
        method = require('./streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('./streaming/rtsp.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    method.snapshot(logger, camera, cb);
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

function getSocketIOStream(cameraid, options)
{
    var Writable = stream.Writable;
    util.inherits(Streamer, Writable);

    function Streamer(opt) {
        Writable.call(this, opt);
    }

    Streamer.prototype._write = function(chunk, encoding, next) {

        var frame = {
            camera: cameraid,
            options: options,
            image: chunk
        };

        if (options.local) {
            conn.compress(false).local('cameraFrame', frame);
        } else {
            conn.compress(false).broadcast('cameraFrame', frame);
        }

        next();
    };

    var writable = new Streamer();

    return writable;
}

function cameraKey(cameraid, options)
{
    return [cameraid, options.width, options.height, options.framerate, options.local ? 'local' : 'remote'].join('-');
}

