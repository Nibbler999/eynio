"use strict";

var stream = require('stream');
var http = require('http');
var https = require('https');
var util = require('util');
var url = require('url');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var parts = url.parse(camera.snapshot);

    if (camera.auth_name) {
        parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var httpx = parts.protocol === 'https:' ? https : http;

    httpx.get(parts, function(res) {

        if (res.statusCode === 200) {

            var chunks = [], length = 0;

            res.on('data', function (chunk) {
                chunks.push(chunk);
                length += chunk.length;
            });

            res.on('end', function() {
                cb(Buffer.concat(chunks, length));
            });

        } else {
            logger.error(camera.snapshot, res.statusCode, res.statusMessage);
        }

    }).on('error', function(e) {
        logger.debug(camera.snapshot, e);
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

    var timer, aborted = false;

    var parts = url.parse(camera.snapshot);

    if (camera.auth_name) {
        parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }

    var httpx = parts.protocol === 'https:' ? https : http;

    var keepAliveAgent = new httpx.Agent({ keepAlive: true });
    parts.agent = keepAliveAgent;

    var refresh = function () {

        httpx.get(parts, function(res) {

            if (res.statusCode === 200) {

                res.on('data', function (chunk) {
                    if (!aborted) {
                        readable.push(chunk);
                    }
                });

                res.on('end', function() {
                    if (!aborted) {
                        setTimeout(refresh, 100);
                    }
                });

            } else {
                logger.error(camera.snapshot, res.statusCode, res.statusMessage);
                readable.end();
            }

        }).on('error', function (e) {
            if (!aborted) {
                timer = setTimeout(refresh, 5000);
            }
            logger.debug(camera.snapshot, e);
        });
    };

    refresh();

    var Readable = stream.Readable;
    util.inherits(Streamer, Readable);

    function Streamer(opt) {
        Readable.call(this, opt);

        this.stop = function () {
            clearTimeout(timer);
            aborted = true;
            this.emit('end');
        };
    }

    Streamer.prototype._read = function() { };

    var readable = new Streamer();

    cb(readable);
};

module.exports = streamingMethod;

