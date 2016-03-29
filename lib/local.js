"use strict";

var dgram = require('dgram');

var cfg = require('./configuration.js');

module.exports = function () {

    setInterval(sendBeacons, 20 * 1000);

    var finalhandler = require('finalhandler');
    var http = require('http');
    var serveStatic = require('serve-static');

    var serve = serveStatic(require('path').join(__dirname, '..', 'local'));
    var recordings = serveStatic(cfg.getVideoDirectory());

    var server = http.createServer(function(req, res){

        if (!require('ip').isPrivate(req.connection.remoteAddress)) {
            res.writeHead(403,'Access via local network IP only');
            res.end();
            return;
        }

        if (req.url == '/redirect') {
            res.writeHead(302, {'Location': 'https://my.nhome.ba/'});
            res.end();
            return;
        }

        serve(req, res, function () {
            recordings(req, res, function () {
                finalhandler(req, res)();
            });
        });
    });

    server.listen(38736);

    return server;
};

function sendBeacons()
{
    var beacon = JSON.stringify({
        id: cfg.get('serverid'),
        name: cfg.get('name')
    });

    var message = new Buffer(beacon);

    var socket = dgram.createSocket('udp4');

    socket.send(message, 0, message.length, 2391, '239.255.201.202', function() {
        socket.close();
    });
}

