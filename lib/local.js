"use strict";

var dgram = require('dgram');
var path = require('path');
var Buffer = require('safe-buffer').Buffer;

var cfg = require('./configuration.js');
var info = require('./services/info.js');
var logs = require('./services/logs.js');

var conn;

module.exports = function (c) {

    conn = c;

    setInterval(sendBeacons, 20 * 1000);

    var finalhandler = require('finalhandler');
    var http = require('http');
    var serveStatic = require('serve-static');

    var serve = serveStatic(path.join(__dirname, '..', 'local'));
    var recordings = serveStatic(cfg.getVideoDirectory());

    var server = http.createServer(function(req, res){

        if (!require('ip').isPrivate(req.connection.remoteAddress)) {
            res.writeHead(403,'Access via local network IP only');
            res.end();
            return;
        }

        if (req.url == '/redirect') {
            res.writeHead(302, {'Location': 'https://click.eynio.com/'});
            res.end();
            return;
        }

        serve(req, res, function () {
            recordings(req, res, function () {
                finalhandler(req, res)();
            });
        });
    });

    server.listen(38736, function() {
        startSSE(server);
    });

    return server;
};

function sendBeacons()
{
    var beacon = JSON.stringify({
        id: cfg.get('serverid'),
        name: cfg.get('name')
    });

    var message = Buffer.from(beacon);

    var socket = dgram.createSocket('udp4');

    socket.send(message, 0, message.length, 2391, '239.255.201.202', function() {
        socket.close();
    });
}

function startSSE (server)
{
    var SSE = require('sse');

    var Ultron = require('ultron');

    var sse = new SSE(server);

    sse.on('connection', function (client) {

        sendSEE(client, 'conn-connected', conn.connected);

        var ultron = new Ultron(conn);

        client.on('close', function() {
            ultron.remove('pong, connect, disconnect');
        });

        ultron.on('pong', function (ping) {
            sendSEE(client, 'conn-ping', ping);
        });

        ultron.on('connect', function () {
            sendSEE(client, 'conn-connected', true);
        });

        ultron.on('disconnect', function () {
            sendSEE(client, 'conn-connected', false);
        });

        info.getServerStatus(function (status) {

            sendSEE(client, 'server-status', status);

            if (status.external_ip === '') {
                info.onExternalIP(function (ip) {
                    sendSEE(client, 'server-ip', ip);
                });
            }
        });

        logs.formattedLog(function (log) {
            sendSEE(client, 'full-log', log);
        });

        logs.getActionLog(0, function (log) {
            sendSEE(client, 'action-log', log);
        });

        var claimed = cfg.get('claimed', false);

        if (claimed) {

            sendSEE(client, 'claim', {
                claimed: true
            });

        } else {

            checkClaim(function (claimed) {

                sendSEE(client, 'claim', {
                    claimed: claimed,
                    serverid: cfg.get('serverid')
                });

                cfg.set('claimed', claimed);
            });
        }
    });

    server.sse = sse;
}

function sendSEE(client, type, value)
{
    var message = {
        type: type,
        value: value
    };

    client.send(JSON.stringify(message));
}

function checkClaim(cb)
{
    var get = require('simple-get');

    var url = 'https://api.eynio.com/api/checkclaim';

    var uuid = cfg.get('uuid');

    var params = {
        url: url,
        form: {
            uuid: uuid
        },
        json: true
    };

    get.concat(params, function (err, res, body) {

        if (err) {
            return;
        }

        if (res.statusCode !== 200) {
            return;
        }

        cb(body.claimed);
    });
}

