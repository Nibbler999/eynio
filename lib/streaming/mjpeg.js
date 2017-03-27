"use strict";

var MjpegConsumer = require('./mjpeg-consumer');
var http = require('http');
var https = require('https');
var url = require('url');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var consumer = new MjpegConsumer();

    var parts = url.parse(camera.mjpeg);

    var httpx = parts.protocol === 'https:' ? https : http;

    if (camera.auth_name) {
        parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var req = httpx.get(parts, function(res) {

        if (res.statusCode === 200) {

            res.pipe(consumer);

            consumer.once('data', function (image) {
                req.abort();
                cb(image);
            });

        } else {
            logger.error(camera.mjpeg, res.statusCode, res.statusMessage);
            cb(null);
        }

    }).on('error', function (err) {
        logger.error(camera.mjpeg, err);
        cb(null);
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

    var parts = url.parse(camera.mjpeg);

    var httpx = parts.protocol === 'https:' ? https : http;

    if (camera.auth_name) {
        parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var req = httpx.get(parts, function(res) {

        if (res.statusCode === 200) {

            res.stop = function () {
                req.abort();
            };

            cb(res);

        } else {
            logger.error(camera.mjpeg, res.statusCode, res.statusMessage);
        }

    }).on('error', function (err) {
        logger.error(camera.mjpeg, err);
    });
};

module.exports = streamingMethod;

