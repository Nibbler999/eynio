
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

    var addr = devices[id].addr;

    try {
        var hsl = require('chroma-js')(color_string, color_format).hsl();
    } catch (e){
        log(e);
        return;
    }

    var temp = 0xffff;

    try {

        if (isNaN(hsl[0])) {
            hsl[0] = 0;
        }

        lx.lightsColour(parseInt(hsl[0] / 360 * 65535), parseInt(hsl[1] * 65535), parseInt(hsl[2] * 65535), temp, 0, new Buffer(addr, 'hex'));
    } catch (e) {
        log(e);
    }
}

function getLightState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var addr = devices[id].addr;

    lx.requestStatus(new Buffer(addr, 'hex'));

    if (cb) cb([]);
}
