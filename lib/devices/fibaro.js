"use strict";

var Fibaro = require('fibaro-api');
var Namer = require('../services/namer.js');
var cfg = require('../configuration.js');

var conn, devices = {}, bridges = {}, discoveryInterval;

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Fibaro'});

    discoveryInterval = setInterval(discover, 10000);
};

function discover()
{
    Fibaro.discover(discovered);
}

function discovered(info)
{
    clearInterval(discoveryInterval);

    bridges[info.serial] = new Fibaro(info.ip, 'admin', 'admin');

    loadDevices(startListening);
}

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

    conn.on('toggleShutter', function (command) {
        toggleShutter.apply(command, command.args);
    });

    conn.on('getSensorValue', function (command) {
        getSensorValue.apply(command, command.args);
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

function loadDevices(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    Object.keys(bridges).forEach(function(serial) {

        if (blacklist.indexOf(serial) !== -1) {
            devices = {};
            return;
        }

        bridges[serial].api.devices.list(function (err, devicelist) {

            if (err) {
                log(err);
                return;
            }

            devices = {};

            devicelist.forEach(function(device) {

                // HC2
                if (device.hasOwnProperty('baseType')) {

                    if (!device.enabled || !device.visible || device.baseType === '') {
                        return;
                    }

                // HCL
                } else {

                    if (['unknown_device', 'HC_user', 'weather'].indexOf(device.type) !== -1) {
                        return;
                    }

                    if (device.properties.disabled === '1') {
                        return;
                    }
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

            if (typeof cb === 'function') {
                cb();
            }
        });
    });
}

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: 'Fibaro',
            module: 'fibaro',
            id: bridge,
            ip: null,
            mac: null,
            blacklisted: blacklist.indexOf(bridge) !== -1
        });
    }

    if (typeof cb === 'function') {
        cb(bridgeInfo);
    }
}

function getDevices(cb)
{
    var self = this;

    loadDevices(function() {

        var all = [], type;

        for (var device in devices) {

            type = getType(devices[device].type);

            all.push({
                id: device,
                name: Namer.getName(device),
                type: type.type,
                subtype: type.subtype,
                value: devices[device].value,
                module: 'fibaro'
            });
        }

        require('../common.js').addDeviceProperties.call(self, all);

        if (typeof cb === 'function') {
            cb(all);
        }
    });
}

function switchOn(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var deviceId = devices[id].id;
    var self = this;

    devices[id].dev.api.devices.turnOn(deviceId, function(err) {

        if (err) {
            log('switchOn:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'switch-on');

        conn.broadcast('switchState', { id: id, state: { on: true }});

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function switchOff(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var deviceId = devices[id].id;
    var self = this;

    devices[id].dev.api.devices.turnOff(deviceId, function(err) {

        if (err) {
            log('switchOff:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'switch-off');

        conn.broadcast('switchState', { id: id, state: { on: false }});

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function setDevicePowerState(id, on, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (devices[id].type === 'shutter') {

        if (on) {
            openShutter.call(this, id, cb);
        } else {
            closeShutter.call(this, id, cb);
        }

    } else {

        if (on) {
            switchOn.call(this, id, cb);
        } else {
            switchOff.call(this, id, cb);
        }
    }
}

function getDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (devices[id].type === 'shutter') {

        getShutterValue(id, function (state) {
            if (typeof cb === 'function') {
                cb(state.value === '0');
            }
        });

    } else {

        getSwitchState(id, function (state) {
            if (typeof cb === 'function') {
                cb(state.on);
            }
        });
    }
}

function toggleDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
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

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSensorValue:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var sensorValue = {
            id: id,
            name: Namer.getName(id),
            type: devices[id].type.replace('com.fibaro.', '').replace('Sensor', ''),
            value: result.properties.value
        };

        conn.broadcast('sensorValue', sensorValue);

        if (typeof cb === 'function') {
            cb(sensorValue);
        }
    });
}

function getShutterValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getShutterValue:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var ShutterValue = {
            id: id,
            name: Namer.getName(id),
            value: parseInt(result.properties.value)
        };

        conn.broadcast('shutterValue', ShutterValue);

        if (typeof cb === 'function') {
            cb(ShutterValue);
        }
    });
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSwitchState:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var switchState = { on: result.properties.value === '1' };

        conn.broadcast('switchState', { id: id, state: switchState});

        if (typeof cb === 'function') {
            cb(switchState);
        }
    });
}

function setShutterValue(id, value, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'setValue', 'arg1': value }, function(err) {

        if (err) {
            log('setShutterValue:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        conn.broadcast('shutterValue', { id: id, value: value});

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function openShutter(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;
    var self = this;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'open' }, function(err) {

        if (err) {
            log('openShutter:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'shutter-open');

        conn.broadcast('shutterValue', { id: id, value: 0});

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function closeShutter(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;
    var self = this;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'close' }, function(err) {

        if (err) {
            log('closeShutter:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'shutter-close');

        conn.broadcast('shutterValue', { id: id, value: 100});

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function stopShutter(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.call('callAction', { 'deviceID': deviceId, 'name': 'stop' }, function(err) {

        if (err) {
            log('stopShutter:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        getShutterValue(id, cb);
    });
}

function toggleShutter(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var self = this;

    getShutterValue(id, function (state) {
        if (state.value < 50) {
            closeShutter.call(self, id, cb);
        } else {
            openShutter.call(self, id, cb);
        }
    });
}

function getType(name)
{
    var info = {
        type: 'Unknown',
        subtype: ''
    };

    if (name === 'com.fibaro.binarySwitch' || name === 'binary_light' || name === 'com.fibaro.FGWP101') {
        info.type = 'switch';
    } else if (name === 'com.fibaro.FGR221' || name === 'com.fibaro.FGRM222') {
        info.type = 'shutter';
    } else if (name === 'com.fibaro.FGMS001') {
        info.type = 'sensor';
        info.subtype = 'motion';
    } else if (name.match('Sensor')) {
        info.type = 'sensor';
        info.subtype = name.replace('com.fibaro.', '').replace('Sensor', '');
    } else if (name.match('_sensor')) {
        info.type = 'sensor';
        info.subtype = name.replace('_sensor', '');
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

