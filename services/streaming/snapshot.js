"use strict";

var stream = require('stream');
var http = require('http');
var util = require('util');

module.exports = function (logger, camera, options, cb) {

    var auth, timer, req;

    if (camera.auth_name) {
        auth = camera.auth_name + ':' + camera.auth_pass;
    }

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

