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

        if (!devices.hasOwnProperty('NHomeBridge:' + info.ID)) {

            log('Discovered device');

            logger.debug('device', info);
            logger.debug('device', rinfo);

            var WebSocket = require('ws');

            var ws = new WebSocket('ws://' + rinfo.address + ':' + info.Port);

            ws.once('open', function open() {

                devices['NHomeBridge:' + info.ID] = {
                    name: info.device,
                    ip: rinfo.address,
                    dev: ws
                };

                Namer.add(devices);

                ws.on('message', function (data) {

                    try {
                        var sensorinfo = JSON.parse(data);
                    } catch (e) {
                        logger.error(e);
                        return false;
                    }

                    if (!sensorinfo.temperature) {
                        return false;
                    }

                    for (var s in sensorinfo) {

                        var id = 'NHomeBridge:' + info.ID + ':' + s;

                        sensors[id] = {
                            name: 'NHomeBridge ' + s,
                            value: sensorinfo[s],
                            subtype: s
                        };

                        var sensorValue = {
                            id: id,
                            name: 'NHomeBridge ' + s, // TODO: namer
                            type: s,
                            value: sensorinfo[s]
                        };

                        conn.broadcast('sensorValue', sensorValue);
                    }

                    Namer.add(sensors);
                });
            });

            ws.on('error', function (err) {
                logger.error(err);
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

    conn.on('sendRemoteKey', function () {
        sendRemoteKey.apply(null, arguments);
    });

    conn.on('learnRemoteKey', function () {
        learnRemoteKey.apply(null, arguments);
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

    var handler = function (data) {

        try {
            var jsondata = JSON.parse(data);
        } catch (e) {
            logger.error(e);
            return false;
        }

        if (!jsondata.codeValue_json) {
            return false;
        }

        devices[deviceid].dev.removeListener('message', handler);

        if (cb) cb(data.trim());
    };

    devices[deviceid].dev.on('message', handler);
}

