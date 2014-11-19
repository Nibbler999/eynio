
var lifx = require('lifx');
var lx;

var Namer = require('../services/namer.js');

var conn;

var devices = {}, bridges = {};

function log(msg)
{
    console.log('[LIFX] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        lx = lifx.init();

        lx.on('bulbstate', function(b) {

            var id = 'lifx-' + b.addr.toString('hex');

            var hsl = [(b.hue / 65535) * 360, b.saturation / 65535, b.brightness / 65535];
            var chroma = require('chroma-js')(hsl, 'hsl');
    
            var state = {
                on: b.on,
                level: parseInt((b.brightness / 65535) * 100),
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

    conn.on('getBridges', function() {
        sendBridgeInfo();
    });

    conn.on('getLights', function () {
        getLights();    
    });
    
    conn.on('setLightState', function (id, values) {
        setLightState(id, values);
    });

    conn.on('setLightColor', function (id, color_string, color_format) {
        setLightColor(id, color_string, color_format);
    });

    conn.on('setLightLevel', function (id, level) {
        setLightLevel(id, level);
    });

    conn.on('getLightState', function (id) {
        getLightState(id);
    });
}

function sendBridgeInfo()
{
    for (var bridge in bridges) {
        conn.emit('bridgeInfo', { name: 'LIFX', id: bridge });
    }
}

function getLights()
{
    var lights = [];

    for (device in devices) {
        lights.push({id: device, name: Namer.getName(device)});
    }

    conn.emit('lights', lights);
}

// deprecated
function setLightState(id, values)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var addr = devices[id].addr;

    if (values.on) {
        lx.lightsOn(new Buffer(addr, 'hex'));
    } else {
        lx.lightsOff(new Buffer(addr, 'hex'));
    }
}

function setLightLevel(id, level)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var addr = devices[id].addr;

    if (level > 0) {
        var brightness = parseInt((level / 100) * 65535);
        var temp = 0xffff;
        lx.lightsColour(0, 0, brightness, temp, 0, new Buffer(addr, 'hex'));
        conn.emit('lightState', { id: id, state: { on: true, level: level }});
    } else {
        lx.lightsOff(new Buffer(addr, 'hex'));
    }
}

function setLightColor(id, color_string, color_format)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var addr = devices[id].addr;

    try {
        var hsl = require('chroma-js')(color_string, color_format).hsl();
    } catch (e){
        log(e);
        return;
    }

    var temp = 0xffff;

    try {
        lx.lightsColour(parseInt(hsl[0] / 360 * 65535), parseInt(hsl[1] * 65535), parseInt(hsl[2] * 65535), temp, 0, new Buffer(addr, 'hex'));
    } catch (e) {
        log(e);
    }
}

function getLightState(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var addr = devices[id].addr;

    lx.requestStatus(new Buffer(addr, 'hex'));
}
