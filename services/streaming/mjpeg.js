"use strict";

var stream = require('stream');
var MjpegConsumer = require('mjpeg-consumer');
var Limiter = require('write-limiter');
var http = require('http');
var https = require('https');
var url = require('url');

module.exports = function (logger, camera, options, cb) {

    var consumer = new MjpegConsumer();

    var limiter = new Limiter(1000 / options.framerate);

    var parts = url.parse(camera.mjpeg);

    var httpx = parts.protocol === 'https:' ? https : http;

    if (camera.auth_name) {
        parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }
    
    var req = httpx.get(parts, function(res) {

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
};

