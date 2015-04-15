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

    conn.on('getBridges', function (command) {
        getBridges.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
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

    conn.on('getShutterValue', function (command) {
        getShutterValue.apply(command, command.args);
    });

    conn.on('setShutterValue', function (command) {
        setShutterValue.apply(command, command.args);
    });

    conn.on('openShutter', function (command) {
        openShutter.apply(command, command.args);
    });

    conn.on('closeShutter', function (command) {
        closeShutter.apply(command, command.args);
    });

    conn.on('stopShutter', function (command) {
        stopShutter.apply(command, command.args);
    });

    conn.on('getSensorValue', function (command) {
        getSensorValue.apply(command, command.args);
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

                if (!device.enabled || !device.visible || device.baseType === '') {
                    return;
                }

                devices[serial + ':' + device.id] = {
                    id: device.id,
                    name: device.name,
                    type: device.type,
                    value: getValue(device.properties.value),
                    dev: bridges[serial]
                };
            });

            Namer.add(devices);

            if (cb) cb();
        });
    });
}

function getBridges(cb)
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
    loadDevices(function() {
        var all = [], type;

        for (var device in devices) {

            type = getType(devices[device].type);

            all.push({
                id: device,
                name: Namer.getName(device),
                categories: Cats.getCats(device),
                type: type.type,
                subtype: type.subtype,
                value: devices[device].value
            });
        }

        if (cb) cb(all);
    });
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

function getValue(value)
{
    if (value === 'false') {
        value = false;
    } else if (value === 'true') {
        value = true;
    } else if (!isNaN(parseFloat(value))) {
        value = parseFloat(value);
    }

    return value;
}

