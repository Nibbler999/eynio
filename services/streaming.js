"use strict";

var conn, have_ffmpeg;

var logger, ffmpeg_opts, procs = {}, requests = {}, timers = {};

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

    ffmpeg_opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    if (camera.snapshot) {

        streamSnapshot(cameraid, camera, options);

    } else if (camera.mjpeg) {

        streamMJPEG(cameraid, camera, options);

    } else if (camera.rtsp) {

        streamRTSP(cameraid, camera, options);
    }
}

function stopStreaming(cameraid, options)
{
    var key = cameraKey(cameraid, options);

    if (timers[key]) {
        clearTimeout(timers[key]);
        delete timers[key];
    }

    if (procs[key]) {
        procs[key].kill('SIGKILL');
        delete procs[key];
    }

    if (requests[key]) {
        requests[key].abort();
        delete requests[key];
    }
}

function cameraKey(cameraid, options)
{
    return [cameraid, options.width, options.height, options.framerate].join('-');
}

function streamSnapshot(cameraid, camera, options)
{
    var auth;

    var key = cameraKey(cameraid, options);

    if (camera.auth_name) {
        auth = camera.auth_name + ':' + camera.auth_pass;
    }

    if (have_ffmpeg && (options.width > 0 || options.height > 0)) {

        var args = ['-f', 'mjpeg', '-i', '-'];
        args.push('-vf', 'scale=' + options.width + ':' + options.height);
        args.push('-qscale:v', 5);
        args.push('-f', 'mpjpeg', '-');

        var ffmpeg = procs[key] = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

        ffmpeg.on('error', function(e) {
            logger.error('ffmpeg', e);
            delete procs[key];
        });

        if (logger.debug()) {

            logger.debug('ffmpeg', args.join(' '));

            ffmpeg.stderr.on('data', function (data) {
                logger.debug('ffmpeg', camera.snapshot, data.toString());
            });
        }

        var MjpegConsumer = require('mjpeg-consumer');

        var ffmpeg_consumer = new MjpegConsumer();

        ffmpeg.stdout.pipe(ffmpeg_consumer);

        ffmpeg_consumer.on('data', function (image) {

            var frame = {
                camera: cameraid,
                options: options,
                image: image
            };

            conn.broadcast('cameraFrame', frame);
        });
    }

    var http = require('http');

    var refresh = function () {

        var start = Date.now();

        requests[key] = http.get(camera.snapshot, function(res) {

            if (res.statusCode === 200) {

                var elapsed = Date.now() - start;

                timers[key] = setTimeout(refresh, Math.max(1000 - elapsed, 0));

                if (procs[key]) {

                    res.on('data', function (chunk) {
                        if (procs[key]) {
                            procs[key].stdin.write(chunk);
                        }
                    });

                } else {

                    var body;

                    res.on('data', function (chunk) {
                        if (body) {
                            body = Buffer.concat([body, chunk]);
                        } else {
                            body = new Buffer(chunk);
                        }
                    });

                    res.on('end', function() {

                        var frame = {
                            camera: cameraid,
                            options: options,
                            image: body
                        };

                        conn.broadcast('cameraFrame', frame);
                    });
                }

            } else {

                if (ffmpeg) {
                    ffmpeg.kill('SIGKILL');
                }

                logger.error(camera.snapshot, res.statusCode, res.statusMessage);
            }

        }).on('error', function(e) {
            console.log("Got error: " + e.message);
        });
    };

    refresh();
}

function streamMJPEG(cameraid, camera, options)
{
    var key = cameraKey(cameraid, options);

    var MjpegConsumer = require('mjpeg-consumer');

    var consumer = new MjpegConsumer();

    var Limiter = require('write-limiter');
    var limiter = new Limiter(1000 / options.framerate);

    var parts = require('url').parse(camera.mjpeg);

    var ffmpeg;

    if (camera.auth_name) {
        parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }

    if (have_ffmpeg && (options.width > 0 || options.height > 0)) {

        var args = ['-f', 'mjpeg', '-i', '-'];
        args.push('-vf', 'scale=' + options.width + ':' + options.height);
        args.push('-qscale:v', 5);
        args.push('-f', 'mpjpeg', '-');

        ffmpeg = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

        ffmpeg.on('error', function(e) {
            ffmpeg = false;
            logger.error('ffmpeg', e);
        });

        if (logger.debug()) {

            logger.debug('ffmpeg', args.join(' '));

            ffmpeg.stderr.on('data', function (data) {
                logger.debug('ffmpeg', camera.mjpeg, data.toString());
            });
        }
    }

    requests[key] = require('http').get(parts, function(res) {

        if (res.statusCode === 200) {

            var source = res.pipe(consumer).pipe(limiter);

            if (ffmpeg) {

                source.pipe(ffmpeg.stdin);

                var ffmpeg_consumer = new MjpegConsumer();
                source = ffmpeg.stdout.pipe(ffmpeg_consumer);
            }

            source.on('data', function (image) {

                var frame = {
                    camera: cameraid,
                    options: options,
                    image: image
                };

                conn.broadcast('cameraFrame', frame);
            });

        } else {

            if (ffmpeg) {
                ffmpeg.kill('SIGKILL');
            }

            logger.error(camera.mjpeg, res.statusCode, res.statusMessage);
        }

    }).on('error', function (err) {
        logger.error(camera.mjpeg, err);
    });
}

function streamRTSP(cameraid, camera, options)
{
    if (!have_ffmpeg) {
        logger.error('Need ffmpeg for RTSP streaming');
        return false;
    }

    var key = cameraKey(cameraid, options);

    var url = camera.rtsp;

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    var args = ['-f', 'rtsp', '-i', url];

    args.push('-f', 'mpjpeg', '-qscale:v', 5);

    if (options.width > 0 || options.height > 0) {
        args.push('-vf', 'scale=' + options.width + ':' + options.height);
    }

    args.push('-r', options.framerate);

    args.push('-');

    var ffmpeg = procs[key] = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

    ffmpeg.on('error', function(e) {
        logger.error('ffmpeg', e);
        delete procs[key];
    });

    if (logger.debug()) {

        logger.debug('ffmpeg', args.join(' '));

        ffmpeg.stderr.on('data', function (data) {
            logger.debug('ffmpeg', camera.rtsp, data.toString());
        });
    }

    var MjpegConsumer = require('mjpeg-consumer');

    var ffmpeg_consumer = new MjpegConsumer();

    ffmpeg.stdout.pipe(ffmpeg_consumer).on('data', function (image) {

        var frame = {
            camera: cameraid,
            options: options,
            image: image
        };

        conn.broadcast('cameraFrame', frame);
    });
}

