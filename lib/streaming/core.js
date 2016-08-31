"use strict";

var logger, ffmpeg;

var cfg = require('../configuration.js');
var fs = require('fs');
var MjpegConsumer = require('./mjpeg-consumer');
var Limiter = require('write-limiter');
var pump = require('pump');
var WebMParser = require('./webm-parser');

var sources = {}, destinations = {}, callbacks = [];

var Streamcore = function(l) {

    logger = l.child({component: 'Streamcore'});

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

    Streamcore.getImage(id, function (image) {

        if (!image) {
            return false;
        }

        saveImageDimensions(camera, image);

        Streamcore.makeThumbnail(image, camera, cb);
    });
};

Streamcore.runStream = function (cameraid, camera, options, destination, key, thumbnail)
{
    if (!ffmpeg.available && options.encoder && options.encoder !== 'jpeg') {
        logger.error('Video encoding requires ffmpeg to be installed');
        return false;
    }

    destinations[key] = destination;

    var pipeSource = function (source) {

        if (thumbnail) {
            Streamcore.thumbnail(source, camera, thumbnail);
        }

        var streams = [source];

        if (options.framerate > 0) {

            var consumer = new MjpegConsumer();
            var limiter = new Limiter(1000 / options.framerate);

            streams.push(consumer, limiter);
        }

        if (ffmpeg.available && (options.width > 0 || options.height > 0 || camera.rotate || (options.encoder && options.encoder !== 'jpeg'))) {

            var encoder = ffmpeg.getEncoder(options, camera.rotate);

            if (!encoder) {
                return false;
            }

            streams.push(encoder);
        }

        if (options.encoder === 'vp8-mse') {
            streams.push(new WebMParser());
        }

        if (!options.encoder || options.encoder === 'jpeg') {
            streams.push(new MjpegConsumer());
        }

        streams.push(destination);

        pump(streams, function (err) {

            if (err) {
                logger.debug('Error ending stream', err);
            }

            source.unpipe(streams[1]);

            delete destinations[key];
        });

        source.listenerCount++;
    };

    if (sources[cameraid]) {
        pipeSource(sources[cameraid]);
    } else {

        getSourceStream(camera, options, function (source) {

            if (!source) {
                return false;
            }

            source.listenerCount = 0;

            source.setMaxListeners(100);

            sources[cameraid] = source;

            source.destroy = function () {
                if (--source.listenerCount === 0) {
                    source.stop();
                    delete sources[cameraid];
                }
            };

            pipeSource(source);
        });
    }
};

Streamcore.thumbnail = function (source, camera, thumbnail) {

    var options = {
        width: -1,
        height: 120
    };

    var scaler = ffmpeg.getEncoder(options, camera.rotate);

    if (!scaler) {
        return;
    }

    var consumer = new MjpegConsumer();

    source.pipe(scaler).pipe(consumer);

    consumer.once('data', function (image) {
        fs.writeFile(thumbnail, image);
        scaler.end();
    });
}

Streamcore.stopStreaming = function (key) {

    if (destinations[key]) {
        destinations[key].end();
    }
};

Streamcore.makeThumbnail = function (image, camera, cb) {

    var options = {
        width: -1,
        height: 120
    };

    if (ffmpeg.available) {

        var scaler = ffmpeg.getEncoder(options, camera.rotate);

        if (!scaler) {
            cb(false);
            return;
        }

        var consumer = new MjpegConsumer();

        scaler.pipe(consumer);

        consumer.once('data', function (thumbnail) {
            cb(thumbnail);
        });

        scaler.write(image);
        scaler.end();

    } else {
        cb(image);
    }
};

Streamcore.finalize = function (filename, cb) {
    ffmpeg.finalize(filename, cb);
};

Streamcore.getImage = function (id, cb) {

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

    if (sources[id]) {

        var consumer = new MjpegConsumer();

        sources[id].pipe(consumer);

        consumer.once('data', function (image) {
            cb(image);
            sources[id].unpipe(consumer);
            consumer.end();
        });

        return;
    }

    if (camera.snapshot) {
        method = require('../streaming/snapshot.js');
    } else if (camera.mjpeg) {
        method = require('../streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('../streaming/rtsp.js');
    } else if (camera.screencapture) {
        method = require('../streaming/screencapture.js');
    } else if (camera.local) {
        method = require('../streaming/local.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    try {
        method.snapshot(logger, camera, cb);
    } catch (e) {
        logger.error(e);
        cb(false);
    }
}

function getSourceStream(camera, options, cb)
{
    var method;

    if (camera.mjpeg) {
        method = require('../streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('../streaming/rtsp.js');
    } else if (camera.screencapture) {
        method = require('../streaming/screencapture.js');
    } else if (camera.local) {
        method = require('../streaming/local.js');
    } else if (camera.snapshot) {
        method = require('../streaming/snapshot.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    try {
        method.stream(logger, camera, options, cb);
    } catch (e) {
        logger.error(e);
        cb(false);
    }
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

module.exports = Streamcore;

