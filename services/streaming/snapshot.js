"use strict";

var stream = require('stream');
var http = require('http');
var https = require('https');
var util = require('util');
var url = require('url');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var auth;

    if (camera.auth_name) {
        auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var parts = url.parse(camera.snapshot);

    var httpx = parts.protocol === 'https:' ? https : http;

    var req = httpx.get(parts, function(res) {

        if (res.statusCode === 200) {

            var body;

            res.on('data', function (chunk) {
                if (body) {
                    body = Buffer.concat([body, chunk]);
                } else {
                    body = new Buffer(chunk);
                }
            });

            res.on('end', function() {
                cb(body);
            });

        } else {
            logger.error(camera.snapshot, res.statusCode, res.statusMessage);
        }

    }).on('error', function(e) {
        logger.debug(camera.snapshot, e);
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

    var auth, timer, req;

    if (camera.auth_name) {
        auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var parts = url.parse(camera.snapshot);

    var httpx = parts.protocol === 'https:' ? https : http;

    var keepAliveAgent = new httpx.Agent({ keepAlive: true });
    parts.agent = keepAliveAgent;

    var interval = 0;

    if (options.framerate > 0) {
        interval = 1000 / options.framerate;
    }

    var refresh = function () {

        var start = Date.now();

        req = httpx.get(parts, function(res) {

            if (res.statusCode === 200) {

                var elapsed = Date.now() - start;

                timer = setTimeout(refresh, Math.max(interval - elapsed, 0));

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
            logger.debug(camera.snapshot, e);
        });
    };

    refresh();

    var Readable = stream.Readable;
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
};

module.exports = streamingMethod;

