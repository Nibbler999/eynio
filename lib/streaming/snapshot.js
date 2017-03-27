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

    var httpx;

    if (parts.protocol === 'http:') {
        httpx = http;
    } else if (parts.protocol === 'https:') {
        httpx = https;
    } else {
        logger.error('Protocol must be http or https for snapshot streaming');
        return cb(null);
    }

    httpx.get(parts, function(res) {

        if (res.statusCode === 200) {

            var chunks = [], length = 0;

            res.on('data', function (chunk) {
                chunks.push(chunk);
                length += chunk.length;
            });

            res.on('end', function() {

                if (length < 2) {
                    logger.error(camera.id, 'Empty response');
                    return cb(null);
                }

                var image = Buffer.concat(chunks, length);

                if (image[0] === 0xff && image[1] === 0xd8) {
                    cb(image);
                } else {
                    logger.error(camera.id, 'Non-JPEG response');
                    cb(null);
                }
            });

        } else {
            logger.error(camera.id, res.statusCode, res.statusMessage);
            cb(null);
        }

    }).on('error', function(e) {
        logger.error(camera.id, e);
        cb(null);
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

    if (!/^https?:\/\//.test(camera.snapshot)) {
        logger.error('Protocol must be http or https for snapshot streaming');
        return cb(false);
    }

    var readable = new Streamer(camera, logger);

    cb(readable);
};

function Streamer(camera, logger) {

    stream.Readable.call(this, {});

    this.pending = false;
    this.wanted = false;
    this.logger = logger;

    this.stop = function () { };

    this.parts = url.parse(camera.snapshot);

    if (camera.auth_name) {
        this.parts.auth = camera.auth_name + ':' + camera.auth_pass;
    }

    if (this.parts.protocol === 'https:') {
        this.httpx = https;
    } else {
        this.httpx = http;
    }

    this.parts.agent = new this.httpx.Agent({ keepAlive: true });
}

util.inherits(Streamer, stream.Readable);

Streamer.prototype.request = function() {

    this.pending = true;

    var self = this;

    this.httpx.get(this.parts, function(res) {

        if (res.statusCode === 200) {

            res.on('data', function (chunk) {
                self.wanted = self.push(chunk);
            }).on('end', function () {
                if (self.wanted) {
                    setTimeout(self.request.bind(self), 100);
                } else {
                    self.pending = false;
                }
            });
        } else {
            self.logger.error(res.statusCode, res.statusMessage);
            self.push(null);
            self.pending = false;
        }

    }).on('error', function (e) {
        self.logger.error(e);
        self.push(null);
        self.pending = false;
    });
};

Streamer.prototype._read = function() {
    this.wanted = true;
    if (!this.pending) {
        this.request();
    }
};

module.exports = streamingMethod;

