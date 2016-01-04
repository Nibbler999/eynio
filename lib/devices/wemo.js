"use strict";

var Wemo = require('wemo-client');

var Namer = require('../services/namer.js');

var conn, devices = {}, found = false;

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'WeMo'});

    var wemo = new Wemo();

    wemo.discover(function(device) {

        if (!found) {
            startListening();
            found = true;
        }

        var client = wemo.client(device);

        if (device.deviceType === 'urn:Belkin:device:bridge:1') {

            client.getEndDevices(function (err, endDevices) {

                if (err) {
                    logger.error(err);
                    return;
                }

                endDevices.forEach(function (endDevice) {

                    var on = endDevice.capabilities['10006'] === '1';
                    var level = Math.round(endDevice.capabilities['10008'].split(':')[0] / 255 * 100);

                    var state = {
                        on: on,
                        level: level,
                        hsl: [0, 0, level / 200],
                        hex: '#ffffff'
                    };

                    devices[endDevice.deviceId] = {
                        name: endDevice.friendlyName,
                        type: 'light',
                        state: state,
                        dev: client
                    };
                });

                Namer.add(devices);
            });

            client.on('statusChange', function (id, capability, value) {

                if (capability === '10006') {
                    devices[id].state.on = value === '1';
                } else if (capability === '10008') {
                    devices[id].state.level = Math.round(value.split(':')[0] / 255 * 100);
                    devices[id].state.hsl = [0, 0, devices[id].state.level / 200];
                }

                conn.broadcast('lightState', { id: id, state: devices[id].state });
            });

        } else {

            client.on('binaryState', function (value) {

                var id = this.device.serialNumber;

                var device = devices[id];

                if (device.type === 'switch') {

                    device.value = value >= 1;

                    var switchState = { on: device.value };

                    conn.broadcast('switchState', { id: id, state: switchState});

                } else if (device.type === 'sensor') {

                    device.value = value;

                    var sensorValue = {
                        id: id,
                        name: Namer.getName(id),
                        type: 'motion',
                        value: device.value
                    };

                    conn.broadcast('sensorValue', sensorValue);
                    conn.emit('alarmCheck', sensorValue);
                }
            });

            devices[device.serialNumber] = {
                name: device.friendlyName,
                type: device.deviceType === 'urn:Belkin:device:sensor:1' ? 'sensor' : 'switch',
                subtype: device.type === 'sensor' ? 'motion' : '',
                value: device.binaryState === '1',
                dev: client
            };

            Namer.add(devices);
        }
    });
};

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

    conn.on('getLightState', function (command) {
        getLightState.apply(command, command.args);
    });

    conn.on('setLightState', function (command) {
        setLightState.apply(command, command.args);
    });

    conn.on('setLightWhite', function (command) {
        setLightWhite.apply(command, command.args);
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
            state: devices[device].state,
            type: devices[device].type,
            subtype: devices[device].subtype,
            module: 'wemo'
        });
    }

    require('../common.js').addDeviceProperties.call(this, all);

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

    var self = this;

    devices[id].dev.setBinaryState(1, function(err) {

        if (err) {
            logger.error('switchOn', err);
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

    var self = this;

    devices[id].dev.setBinaryState(0, function(err) {

        if (err) {
            logger.error('switchOff', err);
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

    if (devices[id].type === 'light') {

        setLightState.call(this, id, {on: on}, cb);

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

    var mycb = function (state) {
        if (typeof cb === 'function') {
            cb(state.on);
        }
    };

    if (devices[id].type === 'light') {
        getLightState(id, mycb);
    } else {
        getSwitchState(id, mycb);
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

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var state = { on : devices[id].value };

    conn.broadcast('switchState', { id: id, state: state });

    if (typeof cb === 'function') {
        cb(state);
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
        type: 'motion',
        value: devices[id].value
    };

    conn.broadcast('sensorValue', sensorValue);

    if (typeof cb === 'function') {
        cb(sensorValue);
    }
}

function getLightState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    conn.broadcast('lightState', { id: id, state: devices[id].state });

    if (typeof cb === 'function') {
        cb(devices[id].state);
    }
}

function setLightState(id, values, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var capability = 10006;
    var value = values.on ? 1 : 0;

    var self = this;

    devices[id].dev.setDeviceStatus(id, capability, value, function(err) {

        if (err) {
            logger.error('setLightState', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (values.on) {
            self.log(id, Namer.getName(id), 'light-on');
        } else {
            self.log(id, Namer.getName(id), 'light-off');
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

    var capability = 10008;
    var value = (brightness / 100) * 255;

    devices[id].dev.setDeviceStatus(id, capability, value, function(err) {

        if (err) {
            logger.error('setLightState', err);
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

