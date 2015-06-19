"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');
var cfg = require('../configuration.js');

var conn;

var sensors = {}, devices = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'NHomeBridge'});

    var server = require('dgram').createSocket("udp4");

    server.bind(2390, function () {
        server.addMembership('224.0.0.1');
    });

    server.on('message', function (packet, rinfo) {

        var info = JSON.parse(packet.toString());

        if (!devices.hasOwnProperty('NHomeBridge:' . info.ID)) {

            log('Discovered device');

            var WebSocket = require('ws');

            var ws = new WebSocket('ws://' + rinfo.address + ':' + info.Port);

            ws.once('open', function open() {

                devices['NHomeBridge:' . info.ID] = {
                    name: info.device,
                    ip: rinfo.address,
                    dev: ws
                };

                Namer.add(devices);

                ws.send('sensor');

                ws.once('message', function (data) {

                    var sensorinfo = JSON.parse(data);

                    for (var s in sensorinfo) {
                        sensors['NHomeBridge:' . info.ID + ':' + s] = {
                            name: 'NHomeBridge ' + s,
                            value: sensorinfo[s],
                            subtype: s
                        };
                    }

                    Namer.add(sensors);
                });
            });
        }
    });

    server.once('message', function () {
        startListening();
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('getRemotes', function (command) {
        getRemotes.apply(command, command.args);
    });

    conn.on('sendRemoteKey', function (command) {
        sendRemoteKey.apply(command, command.args);
    });

    conn.on('learnRemoteKey', function (command) {
        learnRemoteKey.apply(command, command.args);
    });
}

function getDevices(cb)
{
    var blacklist = cfg.get('blacklist_devices', []);

    var all = [];

    for (var sensor in sensors) {
        all.push({
            id: sensor,
            name: Namer.getName(sensor),
            value: sensors[sensor].value,
            type: 'sensor',
            subtype: sensors[sensor].subtype,
            categories: Cats.getCats(sensor),
            blacklisted: blacklist.indexOf(sensor) !== -1
        });
    }

    if (cb) cb(all);
}

function getRemotes(cb)
{
    var r = [];

    for (var device in devices) {
        r.push({
            id: device,
            name: Namer.getName(device)
        });
    }

    conn.broadcast('remotes', r);

    if (cb) cb(r);
}

function sendRemoteKey(remote, code, cb)
{
    if (!devices.hasOwnProperty(remote.deviceid)) {
        if (cb) cb([]);
        return;
    }

    devices[remote.deviceid].dev.send(code);

    if (cb) cb(true);
}

function learnRemoteKey(deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        if (cb) cb([]);
        return;
    }

    devices[deviceid].dev.once('message', function (data) {
        if (cb) cb(data);
    });
}

