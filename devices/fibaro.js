"use strict";

var Fibaro = require('fibaro-api');
var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {}, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Fibaro'});

    Fibaro.discover(function(info) {

        bridges[info.serial] = new Fibaro(info.ip, 'admin', 'admin');

        loadDevices(startListening);
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getDevices', function (cb) {
        loadDevices(function() {
            getDevices(cb);
        });
    });

    conn.on('switchOn', function (id) {
        switchOn(id);
    });

    conn.on('switchOff', function (id) {
        switchOff(id);
    });

    conn.on('getSwitches', function (cb) {
        loadDevices(function() {
            getSwitches(cb);
        });
    });

    conn.on('getSwitchState', function (id, cb) {
        getSwitchState(id, cb);
    });

    conn.on('getShutters', function (cb) {
        loadDevices(function() {
            getShutters(cb);
        });
    });

    conn.on('getShutterValue', function (id, cb) {
        getShutterValue(id, cb);
    });

    conn.on('setShutterValue', function (id, value, cb) {
        setShutterValue(id, value, cb);
    });

    conn.on('openShutter', function (id, cb) {
        openShutter(id, cb);
    });

    conn.on('closeShutter', function (id, cb) {
        closeShutter(id, cb);
    });

    conn.on('stopShutter', function (id, cb) {
        stopShutter(id, cb);
    });

    conn.on('getSensors', function (cb) {
        loadDevices(function() {
            getSensors(cb);
        });
    });

    conn.on('getSensorValue', function (id, cb) {
        getSensorValue(id, cb);
    });
}

function loadDevices(cb)
{
    Object.keys(bridges).forEach(function(serial) {

        bridges[serial].api.devices.list(function (err, devicelist) {

            if (err) {
                log(err);
                return;
            }

            devicelist.forEach(function(device) {

                if (!device.enabled || !device.visible) {
                    return;
                }

                devices[serial + ':' + device.id] = {
                    id: device.id,
                    name: device.name,
                    type: getType(device.type),
                    dev: bridges[serial]
                };
            });

            Namer.add(devices);

            if (cb) cb();
        });
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'Fibaro', id: bridge });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getDevices(cb)
{
    var all = [], type;

    for (var device in devices) {

        type = getType(devices[device].type);

        all.push({
            id: device,
            name: Namer.getName(device),
            categories: Cats.getCats(device),
            type: type.type,
            subtype: type.subtype
        });
    }

    if (cb) cb(all);
}

function getSwitches(cb)
{
    var switches = [];

    for (var device in devices) {
        if (devices[device].type === 'com.fibaro.binarySwitch') {
            switches.push({
                id: device,
                name: Namer.getName(device),
                categories: Cats.getCats(device)
            });
        }
    }

    conn.broadcast('switches', switches);

    if (cb) cb(switches);
}

function getSensors(cb)
{
    var sensors = [];

    for (var device in devices) {
        if (devices[device].type.match('Sensor')) {
            sensors.push({
                id: device,
                name: Namer.getName(device),
                type: devices[device].type.replace('com.fibaro.', '').replace('Sensor', ''),
                categories: Cats.getCats(device)
            });
        }
    }

    conn.broadcast('sensors', sensors);

    if (cb) cb(sensors);
}

function getShutters(cb)
{
    var shutters = [];

    for (var device in devices) {
        if (devices[device].type === 'com.fibaro.FGR221' || devices[device].type === 'com.fibaro.FGRM222') {
            shutters.push({
                id: device,
                name: Namer.getName(device),
                categories: Cats.getCats(device)
            });
        }
    }

    conn.broadcast('shutters', shutters);

    if (cb) cb(shutters);
}

function switchOn(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.turnOn(deviceId, function(err, result) {

        if (err) {
            log('switchOn:' + err);
            return;
        }

        conn.broadcast('switchState', { id: id, state: { on: true }});
    });
}

function switchOff(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.turnOff(deviceId, function(err, result) {

        if (err) {
            log('switchOff:' + err);
            return;
        }

        conn.broadcast('switchState', { id: id, state: { on: false }});
    });
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSensorValue:' + err);
            if (cb) cb(null);
            return;
        }

        var sensorValue = {
            id: id,
            name: Namer.getName(id),
            type: devices[id].type.replace('com.fibaro.', '').replace('Sensor', ''),
            value: result.properties.value
        };

        conn.broadcast('sensorValue', sensorValue);

        if (cb) cb(sensorValue);
    });
}

function getShutterValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getShutterValue:' + err);
            if (cb) cb(null);
            return;
        }

        var ShutterValue = {
            id: id,
            name: Namer.getName(id),
            value: result.properties.value
        };

        conn.broadcast('shutterValue', ShutterValue);

        if (cb) cb(ShutterValue);
    });
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSwitchState:' + err);
            if (cb) cb(null);
            return;
        }

        var switchState = { on: result.properties.value === '1' };

        conn.broadcast('switchState', { id: id, state: switchState});

        if (cb) cb(switchState);
    });
}

function setShutterValue(id, value, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'setValue', 'arg1': value }, function(err, result) {

        if (err) {
            log('setShutterValue:' + err);
            return;
        }

        conn.broadcast('shutterValue', { id: id, value: value});

        if (cb) cb(value);
    });
}

function openShutter(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'open' }, function(err, result) {

        if (err) {
            log('openShutter:' + err);
            return;
        }

        conn.broadcast('shutterValue', { id: id, value: 0});

        if (cb) cb(0);
    });
}

function closeShutter(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'close' }, function(err, result) {

        if (err) {
            log('closeShutter:' + err);
            return;
        }

        conn.broadcast('shutterValue', { id: id, value: 100});

        if (cb) cb(100);
    });
}

function stopShutter(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'stop' }, function(err, result) {

        if (err) {
            log('stopShutter:' + err);
            return;
        }

        getShutterValue(id, cb);
    });
}

function getType(name)
{
    var info = {
        type: 'Unknown',
        subtype: ''
    };

    if (name === 'com.fibaro.binarySwitch') {
        info.type = 'switch';
    } else if (name === 'com.fibaro.FGR221' || name === 'com.fibaro.FGRM222') {
        info.type = 'shutter';
    } else if (name.match('Sensor')) {
        info.type = 'sensor';
        info.subtype = name.replace('com.fibaro.', '').replace('Sensor', '');
    }

    return info;
}

