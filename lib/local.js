"use strict";

module.exports = function () {

    var finalhandler = require('finalhandler');
    var http = require('http');
    var serveStatic = require('serve-static');

    var serve = serveStatic(require('path').join(__dirname, '..', 'local'));

    var server = http.createServer(function(req, res){

        if (!require('ip').isPrivate(req.connection.remoteAddress)) {
            res.writeHead(403,'Access via local network IP only');
            res.end();
            return;
        }

        if (req.headers.origin) {
            res.status(403);
            res.end();
            return;
        }

        var done = finalhandler(req, res);

        serve(req, res, done);
    });

    server.listen(8008);

    return server;
};

