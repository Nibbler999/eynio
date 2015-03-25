"use strict";

var stream = require('stream');

var conn, have_ffmpeg;

var logger, ffmpeg_opts;

var sources = {}, destinations = {}, scalers = {}, pipes = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    conn.on('startStreaming', function (cameraid, options) {
        startStreaming(cameraid, options);
    });

    conn.on('stopStreaming', function (cameraid, options) {
        stopStreaming(cameraid, options);
    });

    checkFFmpeg();
};

function checkFFmpeg()
{
    try {

        var ffmpeg = require('child_process').spawn('ffmpeg', ['-version']);

        ffmpeg.on('error', function () {
            have_ffmpeg = false;
        });

        ffmpeg.stdout.once('data', function (data) {
            logger.debug(data.toString());
            have_ffmpeg = true;
        });

    } catch (e) {
        logger.warn(e);
        have_ffmpeg = false;
        return;
    }
}

function startStreaming(cameraid, options)
{
    logger.debug('Creating stream from ' + cameraid);

    var cfg = require('../configuration.js');
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.error('Unknown camera', cameraid);
        logger.debug('Known cameras', cameras);
        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var tcpp = require('tcp-ping');

    tcpp.probe(parts.hostname, parts.port, function (err, available) {

        if (!available) {
            logger.error('Camera at', parts.hostname + ':' + parts.port, 'is not available');
            return;
        }

        var play = function (source) {

            var key = cameraKey(cameraid, options);

            var sio = destinations[key] = getSocketIOStream(cameraid, options);

            sio.on('pipe', function () {
                if (!pipes[cameraid]) pipes[cameraid] = 0;
                pipes[cameraid]++;
            });

            sio.on('unpipe', function () {
                if (--pipes[cameraid] === 0) {
                    sources[cameraid].end();
                }
            });

            if (have_ffmpeg && (options.width > 0 || options.height > 0)) {

                var ffmpeg = scalers[key] = getFFmpegStream(options);

                source.pipe(ffmpeg).pipe(sio);

            } else {
                source.pipe(sio);
            }
        };

        if (sources[cameraid] && sources[cameraid].readable) {

            play(sources[cameraid]);

        } else {

            var cb = function (source) {

                sources[cameraid] = source;

                play(source);
            };

            getSourceStream(cameraid, camera, options, cb);
        }
    });
}

function getFFmpegStream(options)
{
    var MjpegConsumer = require('mjpeg-consumer');

    ffmpeg_opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    var args = ['-f', 'mjpeg', '-i', '-'];
    args.push('-vf', 'scale=' + options.width + ':' + options.height);
    args.push('-qscale:v', 5);
    args.push('-f', 'mpjpeg', '-');

    var ffmpeg = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

    ffmpeg.on('error', function(e) {
        ffmpeg = false;
        logger.error('ffmpeg', e);
    });

    if (logger.debug()) {

        logger.debug('ffmpeg', args.join(' '));

        ffmpeg.stderr.on('data', function (data) {
            logger.debug('ffmpeg', data.toString());
        });
    }

    var ffmpeg_consumer = new MjpegConsumer();
    ffmpeg.stdout.pipe(ffmpeg_consumer);

    var Duplex = stream.Duplex;
    var util = require('util');
    util.inherits(Streamer, Duplex);

    function Streamer(opt) {
        Duplex.call(this, opt);
    }

    Streamer.prototype._read = function() { };

    Streamer.prototype._write = function(chunk, encoding, next) {
        ffmpeg.stdin.write(chunk);
        next();
    };

    var duplex = new Streamer();

    duplex.on('unpipe', function () {
        ffmpeg.stdin.end();
    });

    ffmpeg_consumer.on('data', function (chunk) {
        duplex.push(chunk);
    });

    return duplex;
}

function getSocketIOStream(cameraid, options)
{
    var Writable = stream.Writable;
    var util = require('util');
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

        conn.broadcast('cameraFrame', frame);

        next();
    };

    var writable = new Streamer();

    return writable;
}

function getSourceStream(cameraid, camera, options, cb)
{
    if (camera.snapshot) {
        streamSnapshot(cameraid, camera, options, cb);
    } else if (camera.mjpeg) {
        streamMJPEG(cameraid, camera, options, cb);
    } else if (camera.rtsp) {
        streamRTSP(cameraid, camera, options, cb);
    }
}

function stopStreaming(cameraid, options)
{
    var key = cameraKey(cameraid, options);

    if (scalers[key]) {
        scalers[key].unpipe(destinations[key]);
        sources[cameraid].unpipe(scalers[key]);
    } else if (sources[cameraid]) {
        sources[cameraid].unpipe(destinations[key]);
    }
}

function cameraKey(cameraid, options)
{
    return [cameraid, options.width, options.height, options.framerate].join('-');
}

function streamSnapshot(cameraid, camera, options, cb)
{
    var auth, timer, req;

    if (camera.auth_name) {
        auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var http = require('http');

    var refresh = function () {

        var start = Date.now();

        req = http.get(camera.snapshot, function(res) {

            if (res.statusCode === 200) {

                var elapsed = Date.now() - start;

                timer = setTimeout(refresh, Math.max(1000 - elapsed, 0));

                var body;

                res.on('data', function (chunk) {
                    if (body) {
                        body = Buffer.concat([body, chunk]);
                    } else {
                        body = new Buffer(chunk);
                    }
                });

                res.on('end', function() {
                    readable.push(body);
                });

            } else {
                logger.error(camera.snapshot, res.statusCode, res.statusMessage);
            }

        }).on('error', function(e) {
            logger.error(camera.snapshot, e);
        });
    };

    refresh();

    var Readable = stream.Readable;
    var util = require('util');
    util.inherits(Streamer, Readable);

    function Streamer(opt) {
        Readable.call(this, opt);

        this.end = function () {
            clearTimeout(timer);
            req.abort();
            this.readable = false;
        };
    }

    Streamer.prototype._read = function() { };

    var readable = new Streamer();

    cb(readable);
}

function streamMJPEG(cameraid, camera, options, cb)
{
    var MjpegConsumer = require('mjpeg-consumer');

    var consumer = new MjpegConsumer();

    var Limiter = require('write-limiter');
    var limiter = new Limiter(1000 / options.framerate);

    var parts = require('url').parse(camera.mjpeg);

    if (camera.auth_name) {
        parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var req = require('http').get(parts, function(res) {

        if (res.statusCode === 200) {

            var source = res.pipe(consumer).pipe(limiter);

            source.on('end', function () {
                req.abort();
            });

            cb(source);

        } else {
            logger.error(camera.mjpeg, res.statusCode, res.statusMessage);
        }

    }).on('error', function (err) {
        logger.error(camera.mjpeg, err);
    });
}

function streamRTSP(cameraid, camera, options, cb)
{
    if (!have_ffmpeg) {
        logger.error('Need ffmpeg for RTSP streaming');
        return false;
    }

    var url = camera.rtsp;

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    var args = ['-f', 'rtsp', '-i', url];

    args.push('-f', 'mpjpeg');

    args.push('-r', options.framerate);

    args.push('-');

    var ffmpeg = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

    ffmpeg.on('error', function(e) {
        logger.error('ffmpeg', e);
    });

    if (logger.debug()) {

        logger.debug('ffmpeg', args.join(' '));

        ffmpeg.stderr.on('data', function (data) {
            logger.debug('ffmpeg', camera.rtsp, data.toString());
        });
    }

    var MjpegConsumer = require('mjpeg-consumer');

    var ffmpeg_consumer = new MjpegConsumer();

    ffmpeg.stdout.pipe(ffmpeg_consumer);

    ffmpeg_consumer.on('end', function() {
        ffmpeg.kill('SIGKILL');
    });

    cb(ffmpeg_consumer);
}

