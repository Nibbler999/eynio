"use strict";

var Fibaro = require('fibaro-api');
var Namer = require('../services/namer.js');
var cfg = require('../configuration.js');

var conn, devices = {}, bridges = {};

var logger;

var listening = false;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Fibaro'});

    setInterval(discover, 10000);
    discover();

    conn.on('getBridges', function (command) {
        getBridges.apply(command, command.args);
    });
};

function discover()
{
    Fibaro.discover(discovered);
}

function discovered(info)
{
    if (!bridges[info.serial]) {
        bridges[info.serial] = {};
    }

    var auth = cfg.get('auth:' + info.serial, false);

    if (!bridges[info.serial].api && auth) {

        var blacklist = cfg.get('blacklist_bridges', []);

        if (blacklist.indexOf(info.serial) !== -1) {
            return;
        }

        bridges[info.serial] = new Fibaro(info.ip, auth.email, auth.password);

        if (!listening) {
            startListening();
            listening = true;
        }

        loadDevices(info.serial);
    }

    bridges[info.serial].ip = info.ip;
    bridges[info.serial].mac = info.mac;
}

function startListening()
{
    logger.info('Ready for commands');

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

    conn.on('setLightColor', function (command) {
        setLightColor.apply(command, command.args);
    });

    conn.on('setLightWhite', function (command) {
        setLightWhite.apply(command, command.args);
    });

    conn.on('getLightState', function (command) {
        getLightState.apply(command, command.args);
    });
}

function loadDevices(serial)
{
    bridges[serial].api.devices.list(function (err, devicelist) {

        if (err) {
            logger.error(err);
            return;
        }

        devicelist.forEach(function(device) {

            // HC2
            if (device.hasOwnProperty('baseType')) {

                if (!device.enabled || !device.visible || device.baseType === '') {
                    return;
                }

                if (['HC_user', 'com.fibaro.yrWeather'].indexOf(device.type) !== -1) {
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

            if (device.type === 'com.fibaro.ipCamera') {
                return;
            }

            if (device.type === 'com.fibaro.zwaveDevice') {
                return;
            }

            var type = getType(device.type);

            if (type.type === 'light') {

                var rgb = device.properties.color.split(',').slice(0, 3);

                var chroma = require('chroma-js')(rgb, 'rgb');

                var state = {
                    on: device.properties.brightness > 0,
                    level: device.properties.brightness,
                    hsl: chroma.hsl(),
                    hsv: chroma.hsv(),
                    rgb: chroma.rgb(),
                    hex: chroma.hex()
                };

                devices[serial + ':' + device.id] = {
                    id: device.id,
                    name: device.name,
                    type: type.type,
                    state: state,
                    dev: bridges[serial]
                };

            } else {

                devices[serial + ':' + device.id] = {
                    id: device.id,
                    name: device.name,
                    type: type.type,
                    subtype: type.subtype,
                    value: device.properties.value,
                    dev: bridges[serial]
                };
            }
        });

        Namer.add(devices);

        var refreshStates = function (err, data) {

            if (err) {
                logger.error('refreshStates', err);

                setTimeout(function () {
                    bridges[serial].api.refreshStates(refreshStates);
                }, 30000);

                return;
            }

            bridges[serial].api.refreshStates(refreshStates);

            if (!data.changes) {
                return;
            }

            data.changes.forEach(function (change) {

                var id = serial + ':' + change.id;

                if (!devices[id]) {
                    return;
                }

                if (change.hasOwnProperty('value')) {

                    if (devices[id].type === 'switch') {
                        devices[id].value = change.value;
                        conn.broadcast('switchState', { id: id, state: { on: devices[id].value }});
                    } else if (devices[id].type === 'sensor') {
                        devices[id].value = change.value;
                        var sensorValue = {
                            id: id,
                            name: Namer.getName(id),
                            type: devices[id].type,
                            value: devices[id].value
                        };
                        conn.broadcast('sensorValue', sensorValue);
                    } else if (devices[id].type === 'shutter') {
                        devices[id].value = change.value;
                        conn.broadcast('shutterValue', { id: id, value: devices[id].value});
                    }

                } else if (change.hasOwnProperty('color') && devices[id].type === 'light') {

                    var rgb = change.color.split(',').slice(0, 3);

                    var chroma = require('chroma-js')(rgb, 'rgb');

                    devices[id].state.hsl = chroma.hsl();
                    devices[id].state.hsv = chroma.hsv();
                    devices[id].state.rgb = chroma.rgb();
                    devices[id].state.hex = chroma.hex();

                    conn.broadcast('lightState', { id: id, state: devices[id].state });

                } else if (change.hasOwnProperty('brightness') && devices[id].type === 'light') {

                    devices[id].state.on = change.brightness > 0;
                    devices[id].state.level = change.brightness;

                    conn.broadcast('lightState', { id: id, state: devices[id].state });
                }
            });
        };

        bridges[serial].api.refreshStates(refreshStates);
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
            ip: bridges[bridge].ip,
            mac: bridges[bridge].mac,
            blacklisted: blacklist.indexOf(bridge) !== -1
        });
    }

    if (typeof cb === 'function') {
        cb(bridgeInfo);
    }
}

function getDevices(cb)
{
    var all = [];

    for (var device in devices) {

        all.push({
            id: device,
            name: Namer.getName(device),
            type: devices[device].type,
            subtype: devices[device].subtype,
            value: devices[device].value,
            state: devices[device].state,
            module: 'fibaro'
        });
    }

    if (typeof cb === 'function') {
        cb(all);
    }
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
            logger.error('switchOn:' + err);
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
            logger.error('switchOff:' + err);
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

function setLightColor(id, color_string, color_format, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var deviceId = devices[id].id;

    var rgb;

    try {
        rgb = require('chroma-js')(color_string, color_format).rgb();
    } catch (e) {
        logger.error(e);
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    // RGB -> RGBW
    rgb.push(0);

    devices[id].dev.api.devices.setColor(deviceId, rgb, function(err) {

        if (err) {
            logger.error('setColor:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function setLightWhite(id, brightness, temperature, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.setBrightness(deviceId, brightness, function(err) {

        if (err) {
            logger.error('setBrightness:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function getLightState(id, cb)
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
            logger.error('getSwitchState:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var rgb = result.properties.color.split(',').slice(0, 3);

        var chroma = require('chroma-js')(rgb, 'rgb');

        var state = {
            on: result.properties.brightness > 0,
            level: result.properties.brightness,
            hsl: chroma.hsl(),
            hsv: chroma.hsv(),
            rgb: chroma.rgb(),
            hex: chroma.hex()
        };

        if (typeof cb === 'function') {
            cb(state);
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

    } else if (devices[id].type === 'light') {

        getLightState(id, function (state) {
            if (typeof cb === 'function') {
                cb(state.on);
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
            logger.error('getSensorValue:' + err);
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
            logger.error('getShutterValue:' + err);
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
            logger.error('getSwitchState:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var switchState = { on: result.properties.value === '1' || result.properties.value === true };

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
            logger.error('setShutterValue:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

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
            logger.error('openShutter:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'shutter-open');

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
            logger.error('closeShutter:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'shutter-close');

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
            logger.error('stopShutter:' + err);
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

    if (name === 'com.fibaro.binarySwitch' || name === 'binary_light' || name === 'com.fibaro.FGWP101' || name === 'com.fibaro.FGWP102') {
        info.type = 'switch';
    } else if (name === 'com.fibaro.FGR221' || name === 'com.fibaro.FGRM222') {
        info.type = 'shutter';
    } else if (name === 'com.fibaro.FGMS001' || name === 'com.fibaro.FGMS001v2') {
        info.type = 'sensor';
        info.subtype = 'motion';
    } else if (name.match('Sensor')) {
        info.type = 'sensor';
        info.subtype = name.replace('com.fibaro.', '').replace('Sensor', '');
    } else if (name.match('_sensor')) {
        info.type = 'sensor';
        info.subtype = name.replace('_sensor', '');
    } else if (name === 'com.fibaro.seismometer') {
        info.type = 'sensor';
        info.subtype = 'seismometer';
    } else if (name === 'com.fibaro.accelerometer') {
        info.type = 'sensor';
        info.subtype = 'accelerometer';
    } else if (name === 'com.fibaro.FGRGBW441M') {
        info.type = 'light';
    } else if (name === 'com.fibaro.FGSS001') {
        info.type = 'sensor';
        info.subtype = 'smoke';
    } else if (name === 'com.fibaro.FGFS101') {
        info.type = 'sensor';
        info.subtype = 'flood';
    } else {
        logger.warn('Unknown device type', name);
    }

    return info;
}
