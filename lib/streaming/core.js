"use strict";

var logger, ffmpeg;

var cfg = require('../configuration.js');

var sources = {}, destinations = {}, encoders = {}, pipes = {}, callbacks = [];

var Streamcore = function(l) {

    logger = l;
    ffmpeg = require('../streaming/ffmpeg.js')(l);

    ffmpeg.check(function (available) {
        callbacks.forEach(function (cb) {
            cb(available);
        });
    });

    Streamcore.playRecording = ffmpeg.playRecording;
    Streamcore.getEncoder = ffmpeg.getEncoder;

    Streamcore.initialised = true;
};

Streamcore.initialised = false;

Streamcore.ffmpeg = function (cb) {
    if (ffmpeg.available !== null) {
        cb(ffmpeg.available);
    } else {
        callbacks.push(cb);
    }
};

Streamcore.getThumbnail = function (id, cb)
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

        saveImageDimensions(camera, image);

        var options = {
            width: -1,
            height: 120
        };

        if (ffmpeg.available) {

            var scaler = ffmpeg.getEncoder(options, camera.rotate);

            scaler.once('data', function (thumbnail) {
                cb(thumbnail);
            });

            scaler.write(image);
            scaler.end();

        } else {
            cb(image);
        }
    });
};

Streamcore.runStream = function (cameraid, camera, options, destination, key)
{
    if (!ffmpeg.available && options.encoder && options.encoder !== 'jpeg') {
        logger.error('Video encoding requires ffmpeg to be installed');
        return false;
    }

    destinations[key] = destination;

    destination.on('pipe', function () {
        if (!pipes[cameraid]) {
            pipes[cameraid] = 0;
        }
        pipes[cameraid]++;
    });

    destination.on('unpipe', function () {
        if (--pipes[cameraid] === 0) {
            sources[cameraid][options.framerate].end();
        }
    });

    var pipeSource = function (source) {

        if (ffmpeg.available && (options.width > 0 || options.height > 0 || camera.rotate || (options.encoder && options.encoder !== 'jpeg'))) {

            encoders[key] = ffmpeg.getEncoder(options, camera.rotate);

            source = source.pipe(encoders[key]);
        }

        source.pipe(destination);
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
};

Streamcore.stopStreaming = function (cameraid, options, key) {

    if (encoders[key]) {
        encoders[key].unpipe(destinations[key]);
        sources[cameraid][options.framerate].unpipe(encoders[key]);
    } else if (sources[cameraid] && sources[cameraid][options.framerate]) {
        sources[cameraid][options.framerate].unpipe(destinations[key]);
    }
};

Streamcore.stopStreamingAll = function () {

    for (var d in destinations) {
        if (d.indexOf('remote') !== -1) {
            destinations[d].end();
        }
    }
};

function getSourceStream(camera, options, cb)
{
    var method;

    if (camera.mjpeg) {
        method = require('../streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('../streaming/rtsp.js');
    } else if (camera.executable) {
        method = require('../streaming/executable.js');
    } else if (camera.snapshot) {
        method = require('../streaming/snapshot.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    method.stream(logger, camera, options, cb);
}

function saveImageDimensions(camera, image)
{
    var size = require('jpeg-size');

    var s = size(image);

    if (s) {

        if (camera.width !== s.width || camera.height !== s.height) {

            var cameras = cfg.get('cameras', {});

            cameras[camera.id].width = s.width;
            cameras[camera.id].height = s.height;

            cfg.set('cameras', cameras);
        }
    }
}

function getThumbnailImage(id, cb)
{
    var method;

    var cameras = cfg.get('cameras', {});

    var camera = cameras[id];

    if (!camera) {
        logger.debug('Unknown camera', id);
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (camera.snapshot) {
        method = require('../streaming/snapshot.js');
    } else if (camera.mjpeg) {
        method = require('../streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('../streaming/rtsp.js');
    } else if (camera.executable) {
        method = require('../streaming/executable.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    method.snapshot(logger, camera, cb);
}

module.exports = Streamcore;

