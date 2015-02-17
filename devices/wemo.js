"use strict";

var WeMo = require('wemo');

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'WeMo'});

    conn.once('accepted', function (cfg) {

        var client = WeMo.Search();

        client.on('found', function(device) {
            
            devices[device.serialNumber] = {
                name: device.friendlyName,
                type: device.modelName === 'Sensor' ? 'sensor' : 'switch',
                dev: new WeMo(device.ip, device.port)
            };

            Namer.add(devices);
        });

        client.once('found', function() {
            startListening();
        }); 
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('switchOn', function (id) {
        switchOn(id);    
    });
    
    conn.on('switchOff', function (id) {
        switchOff(id);
    });

    conn.on('getSwitches', function (cb) {
        getSwitches(cb);
    });

    conn.on('getSwitchState', function (id, cb) {
        getSwitchState(id, cb);
    });
    
    conn.on('getSensors', function (cb) {
        getSensors(cb);
    });
    
    conn.on('getSensorValue', function (id, cb) {
        getSensorValue(id, cb);
    });
}

function getSwitches(cb)
{
    var switches = [];

    for (var device in devices) {
        if (devices[device].type === 'switch') {
            switches.push({
                id: device,
                name: Namer.getName(device),
                categories: Cats.getCats(device)
            });
        }
    }

    conn.emit('switches', switches);

    if (cb) cb(switches);
}

function switchOn(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setBinaryState(1, function(err, result) {

        if (err) {
            log('switchOn:' + err);
            return;
        }

        getSwitchState(id);
    });
}

function switchOff(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setBinaryState(0, function(err, result) {

        if (err) {
            log('switchOff:' + err);
            return;
        }

        getSwitchState(id);
    });
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    devices[id].dev.getBinaryState(function(err, result) {

        if (err) {
            log('getSwitchState:' + err);
            if (cb) cb(null);
            return;
        }

        var switchState = { on: result === '1'};

        conn.emit('switchState', { id: id, state: switchState});

        if (cb) cb(switchState);
    });
}

function getSensors(cb)
{
    var sensors = [];

    for (var device in devices) {
        if (devices[device].type === 'sensor') {
            sensors.push({
                id: device,
                name: Namer.getName(device),
                categories: Cats.getCats(device)
            });
        }
    }

    conn.emit('sensors', sensors);

    if (cb) cb(sensors);
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    devices[id].dev.getBinaryState(function(err, result) {

        if (err) {
            log('getSwitchState:' + err);
            if (cb) cb(null);
            return;
        }

        var sensorValue = {
            id: id,
            name: Namer.getName(id),
            type: 'motion_sensor',
            value: result === '1'
        };

        conn.emit('sensorValue', sensorValue);
    
        if (cb) cb(sensorValue);
    });
}

