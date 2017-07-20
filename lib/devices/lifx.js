"use strict";

var LifxClient = require('node-lifx').Client;
var lifx = new LifxClient();

var Namer = require('../services/namer.js');

var conn;

var devices = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'LIFX'});

    lifx.once('light-new', function () {
        log('Gateway found');
        startListening();
    });

    lifx.on('light-new', function (light) {

        light.getState(function (err, bulb) {

            if (err) {
                logger.error(err);
                return;
            }

            var state = getState(bulb);

            devices[light.id] = {
                name: bulb.label || 'Un-named',
                state: state,
                client: light
            };

            Namer.add(devices);
        });
    });

    lifx.init();
};

function getState(b)
{
    var hsv = [b.color.hue, b.color.saturation / 100, b.color.brightness / 100];
    var chroma = require('chroma-js')(hsv, 'hsv');

    var state = {
        on: b.power > 0,
        level: b.power * 100,
        hsl: chroma.hsl(),
        hsv: chroma.hsv(),
        rgb: chroma.rgb(),
        hex: chroma.hex()
    };

    return state;
}

function updateState(id, cb)
{
    setTimeout(function() {

        devices[id].client.getState(function (err, bulb) {

            if (err) {
                logger.error(err);
                if (typeof cb === 'function') {
                    cb(false);
                }
                return;
            }

            var state = getState(bulb);

            devices[id].state = state;

            conn.broadcast('lightState', { id: id, state: state });

            if (typeof cb === 'function') {
                cb(true);
            }
        });

    }, 1000);
}

function startListening()
{
    log('Ready for commands');

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('setLightState', function (command) {
        setLightState.apply(command, command.args);
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

function getDevices(cb)
{
    var all = [];

    for (var device in devices) {
        all.push({
            id: device,
            name: Namer.getName(device),
            state: devices[device].state,
            type: 'light',
            module: 'lifx'
        });
    }

    if (typeof cb === 'function') {
        cb(all);
    }
}

// deprecated
function setLightState(id, values, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (values.on) {
        devices[id].client.on();
        this.log(id, Namer.getName(id), 'light-on');
    } else {
        devices[id].client.off();
        this.log(id, Namer.getName(id), 'light-off');
    }

    updateState(id, cb);
}

function setDevicePowerState(id, on, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    setLightState.call(this, id, {on: on}, cb);
}

function getDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    getLightState(id, function (state) {
        if (typeof cb === 'function') {
            cb(state.on);
        }
    });
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

function setLightColor(id, color_string, color_format, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var hsv = require('chroma-js')(color_string, color_format).hsv();

    if (isNaN(hsv[0])) {
        hsv[0] = 0;
    }

    devices[id].client.color(hsv[0], hsv[1] * 100, hsv[2] * 100);
    devices[id].client.on();

    updateState(id, cb);
}

function setLightWhite(id, brightness, temperature, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    temperature = ((temperature * 6500) / 100) + 2500;

    devices[id].client.color(0, 0, brightness, temperature);
    devices[id].client.on();

    updateState(id, cb);
}

function getLightState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    devices[id].client.getState(function (err, bulb) {

        if (err) {
            logger.error(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var state = getState(bulb);

        if (typeof cb === 'function') {
            cb(state);
        }
    });
}

