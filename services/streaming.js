"use strict";

var conn;

var logger, timers = {}, requests = {}, procs = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    conn.on('startStreaming', function (cameraid) {
        startStreaming(cameraid);
    });

    conn.on('stopStreaming', function (cameraid) {
        stopStreaming(cameraid);
    });
};

function startStreaming(cameraid)
{
    logger.debug('Creating stream from ' + cameraid);

    var cfg = require('../configuration.js');
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        return;
    }

    var auth;

    if (camera.snapshot) {

        if (camera.auth_name) {

            auth = {
                user: camera.auth_name,
                pass: camera.auth_pass
            };
        }

        var options = {encoding: null, auth: auth };

        var request = require('request');

        var refresh = function () {

            var start = Date.now();

            request(camera.snapshot, options, function (error, response, body) {

                if (!error && response.statusCode === 200) {

                    var elapsed = Date.now() - start;

                    timers[cameraid] = setTimeout(refresh, Math.max(1000 - elapsed, 0));

                    var frame = {
                        camera: cameraid,
                        image: body
                    };

                    conn.broadcast('cameraFrame', frame);

                } else if (response) {
                    logger.error(camera.url, response);
                } else {
                    logger.error(camera.url, error.message);
                }
            });
        };

        refresh();

    } else if (camera.mjpeg) {

        var MjpegConsumer = require("mjpeg-consumer");
        var consumer = new MjpegConsumer();

        var parts = require('url').parse(camera.mjpeg);

        if (camera.auth_name) {
            parts.auth = camera.auth_name + ':' + camera.auth_pass;
        }

        requests[cameraid] = require('http').get(parts, function(res) {

            res.pipe(consumer).on('data', function (image) {

                var frame = {
                    camera: cameraid,
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

        var JPEGStream = require('jpeg-stream');
        var parser = new JPEGStream();

        var proc = procs[cameraid] = require('child_process').spawn('ffmpeg', ['-re', '-i', camera.rtsp, '-f', 'image2', '-vf', 'fps=1', '-updatefirst', '1', '-']);

        proc.stdout.pipe(parser).on('data', function (image) {

            var frame = {
                camera: cameraid,
                image: image
            };

            conn.broadcast('cameraFrame', frame);
        });
    }
}

function stopStreaming(cameraid)
{
    if (timers[cameraid]) {
        clearTimeout(timers[cameraid]);
    }

    if (requests[cameraid]) {
        requests[cameraid].abort();
    }

    if (procs[cameraid]) {
        procs[cameraid].kill();
    }
}

