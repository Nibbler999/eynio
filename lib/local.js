"use strict";

module.exports = function () {

    var express = require('express');

    var app = express();
    var server = require('http').createServer(app);

    server.listen(8008);

    app.use(function (req, res, next) {

        var ip = req.ip.replace(/^::ffff:/, '');

        if (!require('ip').isPrivate(ip)) {
            res.status(403).send('Access via local network IP only');
            res.end();
        } else {
            next();
        }
    });

    app.use(function (req, res, next) {
        if (req.headers.origin) {
            res.status(403);
            res.end();
        } else {
            next();
        }
    });

    app.use(express.static(require('path').join(__dirname, '..', 'local')));

    return server;
};

