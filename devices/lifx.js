"use strict";

var lifx = require('lifx');
var lx;

var Namer = require('../services/namer.js');

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

    conn.once('accepted', function (cfg) {
    
        lx = lifx.init();

        lx.on('bulbstate', function(b) {

            var id = 'lifx-' + b.addr.toString('hex');

            var hsv = [(b.hue / 65535) * 360, b.saturation / 65535, b.brightness / 65535];
            var chroma = require('chroma-js')(hsv, 'hsv');
    
            var state = {
                on: b.on,
                level: parseInt(((b.dim + 32768) / 65535) * 100),
                hsl: chroma.hsl(),
                hsv: chroma.hsv(),
                rgb: chroma.rgb(),
                hex: chroma.hex()
            };
    
            conn.emit('lightState', { id: id, state: state });
        });

        lx.on('bulb', function(b) {

            var addr = b.addr.toString('hex');

            devices['lifx-' + addr] = {
                name: b.name || 'Un-named',
                addr: addr
            };

            Namer.add(devices);
        });

        lx.on('gateway', function(g) {
            log('Gateway found');
            g.id = g.site.toString('hex');
            bridges[g.id] = g;
            startListening();
        });
    });
}

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getLights', function (cb) {
        getLights(cb);    
    });
    
    conn.on('setLightState', function (id, values) {
        setLightState(id, values);
    });

    conn.on('setLightColor', function (id, color_string, color_format) {
        setLightColor(id, color_string, color_format);
    });

    conn.on('setLightWhite', function (id, brightness, temperature) {
        setLightWhite(id, brightness, temperature);
    });

    conn.on('setLightLevel', function (id, level) {
        setLightLevel(id, level);
    });

    conn.on('getLightState', function (id, cb) {
        getLightState(id, cb);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'LIFX', id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getLights(cb)
{
    var lights = [];

    for (var device in devices) {
        lights.push({id: device, name: Namer.getName(device)});
    }

    conn.emit('lights', lights);

    if (cb) cb(lights);
}

// deprecated
function setLightState(id, values)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var bulb = new Buffer(devices[id].addr, 'hex');

    if (values.on) {
        lx.lightsOn(bulb);
    } else {
        lx.lightsOff(bulb);
    }

    setTimeout(function() { lx.requestStatus(bulb); }, 1000);
}

function setLightLevel(id, level)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var bulb = new Buffer(devices[id].addr, 'hex');

    if (level > 0) {
        var brightness = parseInt((level / 100) * 65535) - 32768;
        lx.lightsOn(bulb);
        lx.setBrightness(brightness, 0, bulb);
    } else {
        lx.lightsOff(bulb);
    }

    setTimeout(function() { lx.requestStatus(bulb); }, 1000);
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
        lx.lightsColour(parseInt(hsv[0] / 360 * 65535), parseInt(hsv[1] * 65535), parseInt(hsv[2] * 65535), temp, 0, bulb);
    } catch (e) {
        logger.error(e);
    }

    setTimeout(function() { lx.requestStatus(bulb); }, 1000);
}

function setLightWhite(id, brightness, temperature)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var bulb = new Buffer(devices[id].addr, 'hex');

    temperature = ((temperature * 6500) / 100) + 2500;

    try {
        lx.lightsColour(0, 0, parseInt(brightness / 100 * 65535), temperature, 0, bulb);
    } catch (e) {
        logger.error(e);
    }

    setTimeout(function() { lx.requestStatus(bulb); }, 1000);
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
