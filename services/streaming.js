"use strict";

var conn;

var logger, procs = {}, requests = {}, timers = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    conn.on('startStreaming', function (cameraid, options) {
        startStreaming(cameraid, options);
    });

    conn.on('stopStreaming', function (cameraid, options) {
        stopStreaming(cameraid, options);
    });
};

function getURL(camera, format)
{
    var url = camera[format];

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    return url;
}

function startStreaming(cameraid, options)
{
    logger.debug('Creating stream from ' + cameraid);

    var cfg = require('../configuration.js');
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        return;
    }

    var Limiter = require('write-limiter');
    var MjpegConsumer = require('mjpeg-consumer');

    var args, url, ffmpeg, ffmpeg_consumer;

    var key = cameraKey(cameraid, options);

    var ffmpeg_opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    if (camera.snapshot) {

        var auth;

        if (camera.auth_name) {
            auth = camera.auth_name + ':' + camera.auth_pass;
        }

        if (options.width > 0 || options.height > 0) {

            args = ['-f', 'mjpeg', '-i', '-'];
            args.push('-vf', 'scale=' + options.width + ':' + options.height);
            args.push('-qscale:v', 5);
            args.push('-f', 'mpjpeg', '-');

            ffmpeg = procs[key] = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

            if (logger.debug()) {

                logger.debug('ffmpeg', args.join(' '));

                ffmpeg.stderr.on('data', function (data) {
                    logger.debug('ffmpeg', camera.mjpeg, data.toString());
                });
            }

            ffmpeg_consumer = new MjpegConsumer();

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

                } else if (response) {
                    logger.error(camera.url, response);
                } else {
                    logger.error(camera.url, error.message);
                }

            }).on('error', function(e) {
                console.log("Got error: " + e.message);
            });
        };

        refresh();

    } else if (camera.mjpeg) {

        var consumer = new MjpegConsumer();
        var limiter = new Limiter(1000 / options.framerate);

        var parts = require('url').parse(camera.mjpeg);

        if (camera.auth_name) {
            parts.auth = camera.auth_name + ':' + camera.auth_pass;
        }

        requests[key] = require('http').get(parts, function(res) {

            var source = res.pipe(consumer).pipe(limiter);

            if (options.width > 0 || options.height > 0) {

                args = ['-f', 'mjpeg', '-i', '-'];
                args.push('-vf', 'scale=' + options.width + ':' + options.height);
                args.push('-qscale:v', 5);
                args.push('-f', 'mpjpeg', '-');

                ffmpeg = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

                if (logger.debug()) {

                    logger.debug('ffmpeg', args.join(' '));

                    ffmpeg.stderr.on('data', function (data) {
                        logger.debug('ffmpeg', camera.mjpeg, data.toString());
                    });
                }

                ffmpeg_consumer = new MjpegConsumer();
                source.pipe(ffmpeg.stdin);
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

            res.on('error', function (err) {
                logger.error(camera.mjpeg, err);
            });

        }).on('error', function (err) {
            logger.error(camera.mjpeg, err);
        });

    } else if (camera.rtsp) {

        url = getURL(camera, 'rtsp');

        args = ['-f', 'rtsp', '-i', url];

        args.push('-f', 'mpjpeg', '-qscale:v', 5);

        if (options.width > 0 || options.height > 0) {
            args.push('-vf', 'scale=' + options.width + ':' + options.height);
        }

        args.push('-r', options.framerate);

        args.push('-');

        ffmpeg = procs[key] = require('child_process').spawn('ffmpeg', args, ffmpeg_opts);

        if (logger.debug()) {

            logger.debug('ffmpeg', args.join(' '));

            ffmpeg.stderr.on('data', function (data) {
                logger.debug('ffmpeg', url, data.toString());
            });
        }

        ffmpeg_consumer = new MjpegConsumer();

        ffmpeg.stdout.pipe(ffmpeg_consumer).on('data', function (image) {

            var frame = {
                camera: cameraid,
                options: options,
                image: image
            };

            conn.broadcast('cameraFrame', frame);
        });
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

