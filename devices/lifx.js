"use strict";

var lifx = require('lifx');
var lx;

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');
var cfg = require('../configuration.js');

var conn;

var devices = {}, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'LIFX'});

    lx = lifx.init();

    lx.on('bulbstate', function(b) {

        var id = 'lifx-' + b.addr.toString('hex');

        var state = getState(b);

        devices[id].state = state;

        conn.broadcast('lightState', { id: id, state: state });
    });

    lx.on('bulb', function(b) {

        var addr = b.addr.toString('hex');

        var state = getState(b);

        devices['lifx-' + addr] = {
            name: b.name || 'Un-named',
            addr: addr,
            state: state
        };

        Namer.add(devices);
    });

    lx.once('gateway', function(g) {
        log('Gateway found');
        g.id = g.site.toString('hex');
        bridges[g.id] = g;
        startListening();
    });
};

function getState(b)
{
    var hsv = [(b.state.hue / 65535) * 360, b.state.saturation / 65535, b.state.brightness / 65535];
    var chroma = require('chroma-js')(hsv, 'hsv');

    var state = {
        on: b.state.power > 0,
        level: parseInt((b.state.power / 65535) * 100, 10),
        hsl: chroma.hsl(),
        hsv: chroma.hsv(),
        rgb: chroma.rgb(),
        hex: chroma.hex()
    };

    return state;
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

    conn.on('setDevicePowerState', function (command) {
        setDevicePowerState.apply(command, command.args);
    });
}

function getBridges(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'LIFX', id: bridge });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getDevices(cb)
{
    var blacklist = cfg.get('blacklist_devices', []);

    var all = [];

    for (var device in devices) {
        all.push({
            id: device,
            name: Namer.getName(device),
            state: devices[device].state,
            categories: Cats.getCats(device),
            type: 'light',
            blacklisted: blacklist.indexOf(device) !== -1
        });
    }

    if (cb) cb(all);
}

// deprecated
function setLightState(id, values, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var bulb = new Buffer(devices[id].addr, 'hex');

    if (values.on) {
        lx.lightsOn(bulb);
        this.log(Namer.getName(id), 'light-on');
    } else {
        lx.lightsOff(bulb);
        this.log(Namer.getName(id), 'light-off');
    }

    setTimeout(function() {
        lx.requestStatus(bulb);
    }, 1000);

    if (cb) cb(true);
}

function setDevicePowerState(id, on, cb)
{
    setLightState.call(this, id, {on: on}, cb);
}

function setLightColor(id, color_string, color_format)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var bulb = new Buffer(devices[id].addr, 'hex');

    var hsv = require('chroma-js')(color_string, color_format).hsv();

    if (isNaN(hsv[0])) {
        hsv[0] = 0;
    }

    var temp = 3500;

    try {
        lx.lightsColour(parseInt(hsv[0] / 360 * 65535, 10), parseInt(hsv[1] * 65535, 10), parseInt(hsv[2] * 65535, 10), temp, 0, bulb);
    } catch (e) {
        logger.error(e);
    }

    setTimeout(function() {
        lx.requestStatus(bulb);
    }, 1000);
}

function setLightWhite(id, brightness, temperature)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var bulb = new Buffer(devices[id].addr, 'hex');

    temperature = ((temperature * 6500) / 100) + 2500;

    try {
        lx.lightsColour(0, 0, parseInt(brightness / 100 * 65535, 10), temperature, 0, bulb);
    } catch (e) {
        logger.error(e);
    }

    setTimeout(function() {
        lx.requestStatus(bulb);
    }, 1000);
}

function getLightState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var bulb = new Buffer(devices[id].addr, 'hex');

    lx.requestStatus(bulb);

    if (cb) cb([]);
}
