"use strict";

var logger, ffmpeg;

var cfg = require('../configuration.js');
var MjpegConsumer = require('./mjpeg-consumer');
var Limiter = require('write-limiter');
var pump = require('pump');
var WebMParser = require('./webm-parser');
var MP4Parser = require('./mp4-parser');
var stream = require('stream');
var mp4 = require('mp4-stream');
var fs = require('fs');

var sources = {}, sourcesMP4 = {}, destinations = {}, callbacks = [];

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
    Streamcore.recordRTSP = ffmpeg.recordRTSP;

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

Streamcore.getThumbnail = function (camera, cb)
{
    getImage(camera, function (image) {

        if (!image) {
            return cb(null);
        }

        saveImageDimensions(camera, image);

        Streamcore.makeThumbnail(image, camera, cb);
    });
};

Streamcore.runStreamMP4 = function (cameraid, camera, options, destination)
{
    var pipeSource = function (source) {

        var streams = [source];

        streams.push(destination);

        pump(streams, function (err) {

            if (err) {
                logger.debug('Error ending stream', err);
            }

            source.unpipe(streams[1]);
        });

        source.listenerCount++;
    };

    if (sourcesMP4[cameraid]) {
        pipeSource(sourcesMP4[cameraid]);
    } else {

        var source = ffmpeg.streamRTSP(camera);

        if (!source) {
            return false;
        }

        source.listenerCount = 0;

        sourcesMP4[cameraid] = source;

        source.destroy = function () {
            if (--source.listenerCount === 0) {
                source.stop();
                delete sourcesMP4[cameraid];
            }
        };

        pipeSource(source);
    }
};

Streamcore.runStream = function (cameraid, camera, options, destination, key)
{
    if (!ffmpeg.available && options.encoder && options.encoder !== 'jpeg') {
        logger.error('Video encoding requires ffmpeg to be installed');
        return false;
    }

    if (destinations[key]) {
        logger.error('Not overwriting destination stream', key);
        return false;
    }

    destinations[key] = destination;

    if (camera.rtsp && options.encoder === 'mp4-mse' && options.width === -1 && options.height === -1 && options.framerate === -1) {
        return this.runStreamMP4(cameraid, camera, options, destination);
    }

    var pipeSource = function (source) {

        var streams = [source];

        if (options.framerate > 0 && options.framerate < 25) {

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

        if (options.encoder === 'mp4-mse') {
            streams.push(new MP4Parser());
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
        });

        source.listenerCount++;
    };

    if (sources[cameraid]) {
        pipeSource(sources[cameraid]);
    } else {

        getSourceStream(camera, function (source) {

            if (!source) {
                return false;
            }

            source.listenerCount = 0;

            source.setMaxListeners(100);

            sources[cameraid] = source;

            source.destroy = function () {
                if (--source.listenerCount === 0) {
                    if (source.stop) {
                        source.stop();
                    }
                    delete sources[cameraid];
                }
            };

            pipeSource(source);
        });
    }
};

Streamcore.stopStreaming = function (key, cb) {

    if (destinations[key]) {
        destinations[key].end(cb);
        delete destinations[key];
    } else if (cb) {
        cb();
    }
};

Streamcore.makeThumbnail = function (image, camera, cb) {

    var options = {
        width: -1,
        height: 240
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

Streamcore.makeSnapshot = function (camera, cb) {

    getImage(camera, function (image) {

        if (!image) {
            cb(false);
            return;
        }

        if (ffmpeg.available) {

            if (camera.rotate) {

                var scaler = ffmpeg.getEncoder({ width: -1, height: -1}, camera.rotate);

                if (!scaler) {
                    cb(false);
                    return;
                }

                var consumer = new MjpegConsumer();

                scaler.pipe(consumer);

                consumer.once('data', function (full) {
                    makeSnapshotThumbnail(full, function (thumbnail) {
                        cb(full, thumbnail);
                    });
                });

                scaler.write(image);
                scaler.end();

            } else {
                makeSnapshotThumbnail(image, function (thumbnail) {
                    cb(image, thumbnail);
                });
            }

        } else {
            cb(image);
        }
    });
};

Streamcore.getDuration = function getDuration (filename, cb) {

    var decode = mp4.decode();
    var success = false;

    var readable = fs.createReadStream(filename);

    readable.pipe(decode).on('box', function (headers) {
        if (headers.type === 'moov') {
            this.decode(function (box) {
                cb(Math.round(box.mvhd.duration / box.mvhd.timeScale));
                success = true;
            });
        } else {
            this.ignore();
        }
    });

    readable.on('end', function () {
        if (!success) {
            cb(null);
        }
    });
};

function makeSnapshotThumbnail(image, cb)
{
    var options = {
        width: -1,
        height: 240
    };

    var scaler = ffmpeg.getEncoder(options);

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
}

Streamcore.finalize = function (filename, cb) {
    ffmpeg.finalize(filename, cb);
};

function getImage(camera, cb)
{
    var method;

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
        return;
    }

    try {
        method.snapshot(logger, camera, cb);
    } catch (e) {
        logger.error(e);
        cb(false);
    }
}

function getSourceStream(camera, cb)
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
        return;
    }

    try {

        var pass = reconnectStream(method, logger, camera);

        cb(pass);

    } catch (e) {
        logger.error(e);
        cb(false);
    }
}

function reconnectStream (method, logger, camera)
{
    var pass = new stream.PassThrough();

    function tryConnect() {

        method.stream(logger, camera, function (source) {

            if (!source) {
                setTimeout(tryConnect, 5000);
                return;
            }

            source.pipe(pass, { end: false });

            pass.stop = function () {
                source.removeAllListeners('end');
                source.stop();
                pass.push(null);
            };

            source.once('end', function () {
                logger.debug('Stream interrrupted');
                source.unpipe(pass);
                setTimeout(tryConnect, 5000);
            });
        });
    }

    tryConnect();

    return pass;
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

