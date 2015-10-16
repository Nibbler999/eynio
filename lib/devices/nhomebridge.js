"use strict";

var Namer = require('../services/namer.js');

var conn;

var sensors = {}, devices = {};

var logger;

var learn_handlers = {};

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'NHomeBridge'});

    var server = require('dgram').createSocket("udp4");

    server.bind(2390, function () {
        server.addMembership('239.255.201.202');
    });

    server.on('message', function (packet, rinfo) {

        var info = JSON.parse(packet.toString());

        if (info.type !== 'IR') {
            return;
        }

        if (!devices.hasOwnProperty('NHomeBridge:' + info.ID)) {

            log('Discovered device');

            logger.debug('device', info);
            logger.debug('device', rinfo);

            var WebSocket = require('ws');

            var ws = new WebSocket('ws://' + rinfo.address + ':' + info.Port);

            ws.once('open', function open() {

                var sendHeartbeats = require('ws-heartbeats');

                sendHeartbeats(ws, {heartbeatTimeout: 2000, heartbeatInterval: 5000});

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
                        conn.emit('alarmCheck', id, sensorValue.value);
                    }

                    Namer.add(sensors);
                });
            });

            ws.on('error', function (err) {
                logger.error(err);
            });

            ws.on('close', function close() {

                logger.debug('WebSocket connection closed');

                delete devices['NHomeBridge:' + info.ID];

                for (var sensor in sensors) {
                    if (sensor.indexOf('NHomeBridge:' + info.ID) === 0) {
                        delete sensors[sensor];
                    }
                }
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
    var all = [];

    for (var sensor in sensors) {
        all.push({
            id: sensor,
            name: Namer.getName(sensor),
            value: sensors[sensor].value,
            type: 'sensor',
            subtype: sensors[sensor].subtype,
            module: 'nhomebridge'
        });
    }

    require('../common.js').addDeviceProperties(all);

    if (typeof cb === 'function') {
        cb(all);
    }
}

function getRemotes(cb)
{
    var r = [];

    for (var device in devices) {
        r.push({
            id: device,
            name: Namer.getName(device),
            module: 'nhomebridge'
        });
    }

    conn.broadcast('remotes', r);

    if (typeof cb === 'function') {
        cb(r);
    }
}

function sendRemoteKey(remote, code, cb)
{
    if (!devices.hasOwnProperty(remote.deviceid)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    devices[remote.deviceid].dev.send(code);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function learnRemoteKey(deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (learn_handlers[deviceid]) {
        devices[deviceid].dev.removeListener('message', learn_handlers[deviceid]);
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

        if (typeof cb === 'function') {
            cb(data.trim());
        }
    };

    learn_handlers[deviceid] = handler;

    devices[deviceid].dev.on('message', handler);
}
