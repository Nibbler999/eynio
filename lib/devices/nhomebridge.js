"use strict";

var Namer = require('../services/namer.js');

var tcpp = require('tcp-ping');
var WebSocket = require('ws');

var conn;

var sensors = {}, devices = {}, switches = {};

var logger;

var learn_handlers = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'NHomeBridge'});

    var server = require('dgram').createSocket("udp4");

    server.bind(2390, function () {
        server.addMembership('239.255.201.202');
    });

    server.on('message', function (packet, rinfo) {

        var data = packet.toString();

        try {
            var info = JSON.parse(data);
        } catch (e) {
            logger.error(e);
            logger.error(data);
            return false;
        }

        var id = 'NHomeBridge:' + info.ID;

        if (devices.hasOwnProperty(id)) {
            return;
        }

        logger.debug('device', info);
        logger.debug('device', rinfo);

        tcpp.probe(rinfo.address, info.Port, function (err, available) {

            if (err) {
                logger.debug(err);
            }

            if (available) {
                logger.info('Discovered', info.type);
                connectBridge(id, info, rinfo);
            } else {
                logger.debug('Discovered', info.type, 'at', rinfo.address, 'but it was not reachable');
            }
        });
    });

    server.once('message', function () {
        startListening();
    });
};

function startListening()
{
    logger.info('Ready for commands');

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

    conn.on('switchOn', function (command) {
        switchOn.apply(command, command.args);
    });

    conn.on('switchOff', function (command) {
        switchOff.apply(command, command.args);
    });

    conn.on('getSwitchState', function (command) {
        getSwitchState.apply(command, command.args);
    });

    conn.on('getDevicePowerState', function (command) {
        getDevicePowerState.apply(command, command.args);
    });

    conn.on('setDevicePowerState', function (command) {
        setDevicePowerState.apply(command, command.args);
    });

    conn.on('toggleDevicePowerState', function (command) {
        toggleDevicePowerState.apply(command, command.args);
    });
}

function connectBridge(id, info, rinfo)
{
    var ws = new WebSocket('ws://' + rinfo.address + ':' + info.Port);

    ws.once('open', function open() {

        var sendHeartbeats = require('ws-heartbeats');

        sendHeartbeats(ws, {heartbeatTimeout: 2000, heartbeatInterval: 5000});

        devices[id] = {
            name: info.device,
            ip: rinfo.address,
            type: info.type,
            dev: ws
        };

        Namer.add(devices);

        if (info.type === 'switch') {

            switches[id] = {
                name: info.device,
                value: null,
                dev: ws
            };

            Namer.add(switches);

            ws.on('message', switchMessageHandler(id));

        } else {
            ws.on('message', bridgeMessageHandler(id));
        }
    });

    ws.on('error', function (err) {
        logger.error(err);
    });

    ws.on('close', function close() {

        logger.debug('WebSocket connection closed');

        delete devices[id];

        for (var sensor in sensors) {
            if (sensor.indexOf(id) === 0) {
                delete sensors[sensor];
            }
        }

        delete switches[id];
    });
}

function switchMessageHandler(id)
{
    return function (data) {

        try {
            var message = JSON.parse(data);
        } catch (e) {
            logger.error(e);
            logger.error(data);
            return false;
        }

        var value = message.state === 1;
        var switchState = { on: value };

        switches[id].value = value;

        conn.broadcast('switchState', { id: id, state: switchState});
    };
}

function bridgeMessageHandler(id)
{
    return function (data) {

        try {
            var sensorinfo = JSON.parse(data);
        } catch (e) {
            logger.error(e);
            logger.error(data);
            return false;
        }

        if (!sensorinfo.temperature) {
            return false;
        }

        for (var s in sensorinfo) {

            var sensorid = id + ':' + s;

            if (sensors[sensorid] && sensors[sensorid].value === sensorinfo[s]) {
                continue;
            }

            var value = sensorinfo[s];

            if (s === 'motion') {
                value = !!value;
            }

            sensors[sensorid] = {
                name: 'NHomeBridge ' + s,
                value: value,
                subtype: s
            };

            var sensorValue = {
                id: sensorid,
                name: 'NHomeBridge ' + s, // TODO: namer
                type: s,
                value: value
            };

            conn.broadcast('sensorValue', sensorValue);
            conn.emit('alarmCheck', sensorValue);
        }

        Namer.add(sensors);
    };
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

    for (var s in switches) {
        all.push({
            id: s,
            name: Namer.getName(s),
            value: switches[s].value,
            type: 'switch',
            module: 'nhomebridge'
        });
    }

    require('../common.js').addDeviceProperties.call(this, all);

    if (typeof cb === 'function') {
        cb(all);
    }
}

function getRemotes(cb)
{
    var r = [];

    for (var device in devices) {
        if (devices[device].type === 'IR') {
            r.push({
                id: device,
                name: Namer.getName(device),
                module: 'nhomebridge'
            });
        }
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
            logger.error(data);
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

function switchOn(id, cb)
{
    if (!switches.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var self = this;

    var message = JSON.stringify({type: 'switch', 'state': '1'});

    switches[id].dev.send(message, function (err) {

        if (err) {
            logger.error('switchOn', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'switch-on');

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function switchOff(id, cb)
{
    if (!switches.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var self = this;

    var message = JSON.stringify({type: 'switch', 'state': '0'});

    switches[id].dev.send(message, function (err) {

        if (err) {
            logger.error('switchOff', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'switch-off');

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function getSwitchState(id, cb)
{
    if (!switches.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var value = switches[id].value;

    var switchState = { on: value };

    conn.broadcast('switchState', { id: id, state: switchState });

    if (typeof cb === 'function') {
        cb(switchState);
    }
}

function setDevicePowerState(id, on, cb)
{
    if (!switches.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (on) {
        switchOn.call(this, id, cb);
    } else {
        switchOff.call(this, id, cb);
    }
}

function getDevicePowerState(id, cb)
{
    if (!switches.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (typeof cb === 'function') {
        cb(switches[id].value);
    }
}

function toggleDevicePowerState(id, cb)
{
    if (!switches.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var self = this;

    getDevicePowerState(id, function (state) {
        setDevicePowerState.call(self, id, !state, cb);
    });
}

