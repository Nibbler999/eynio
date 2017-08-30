"use strict";

var Hub = require('node-xiaomi-smart-home').Hub;

var Namer = require('../services/namer.js');

var conn, devices = {}, found = false;

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Xiaomi'});

    var hub = new Hub();
    hub.listen();

    hub.on('message', function (message) {
        if (message.model === 'gateway' && !found) {
            startListening();
            found = true;
        }
    });

    hub.on('data.motion', function (sid, motion) {

        if (!devices[sid]) {
            devices[sid] = {
                name: sid + ' motion',
                type: 'motion',
                value: motion
            };
            Namer.add(devices);
        }

        var sensorValue = {
            id: sid,
            name: Namer.getName(sid),
            type: 'motion',
            value: motion
        };

        conn.broadcast('sensorValue', sensorValue);
        conn.emit('alarmCheck', sensorValue);
    });

    hub.on('data.magnet', function (sid, open) {

        if (!devices[sid]) {
            devices[sid] = {
                name: sid + ' door',
                type: 'door',
                value: open
            };
            Namer.add(devices);
        }

        var sensorValue = {
            id: sid,
            name: Namer.getName(sid),
            type: 'door',
            value: open
        };

        conn.broadcast('sensorValue', sensorValue);
        conn.emit('alarmCheck', sensorValue);
    });

    hub.on('data.th', function (sid, temperature, humidity) {

        if (!devices[sid]) {
            devices[sid + 'T'] = {
                name: sid + ' temperature',
                type: 'temperature',
                value: temperature
            };
            devices[sid + 'H'] = {
                name: sid + ' humidity',
                type: 'humidity',
                value: humidity
            };
            Namer.add(devices);
        }

        var sensorValueTemp = {
            id: sid + 'T',
            name: Namer.getName(sid + 'T'),
            type: 'temperature',
            value: temperature
        };

        conn.broadcast('sensorValue', sensorValueTemp);
        conn.emit('alarmCheck', sensorValueTemp);

        var sensorValueHum = {
            id: sid + 'H',
            name: Namer.getName(sid + 'H'),
            type: 'humidity',
            value: humidity
        };

        conn.broadcast('sensorValue', sensorValueHum);
        conn.emit('alarmCheck', sensorValueHum);
    });

    // data.button
    // data.plug
};

function startListening()
{
    logger.info('Ready for commands');

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('getSensorValue', function (command) {
        getSensorValue.apply(command, command.args);
    });
}

function getDevices(cb)
{
    var all = [];

    for (var device in devices) {
        all.push({
            id: device,
            name: Namer.getName(device),
            value: devices[device].value,
            type: 'sensor',
            subtype: devices[device].type,
            module: 'xiaomi'
        });
    }

    if (typeof cb === 'function') {
        cb(all);
    }
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var sensorValue = {
        id: id,
        name: Namer.getName(id),
        type: devices[id].type,
        value: devices[id].value
    };

    if (typeof cb === 'function') {
        cb(sensorValue);
    }
}

