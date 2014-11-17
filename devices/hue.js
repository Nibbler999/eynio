
var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var conn, devices = {};

function log(msg)
{
    console.log('[Hue] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {

        hue.locateBridges(function(err, result) {

            if (err) {
                log('locateBridges: ' + err);
                return;
            }
    
            if (result.length == 0) {
                return;
            }
    
            log('Found a bridge');

            var api = new HueApi(result[0].ipaddress, cfg.hue_apikey || 'none');

            api.connect(function(err, config) {

                if (err) {
                    log('connect: ' + err);
                    return;
                }

                // If auth failed this property is missing
                if (!config.hasOwnProperty('ipaddress')) {

                    log('Need to create user');
                    conn.emit('pushthebutton', config.name);

                    var registerInterval = setInterval(function () {
                        log('Creating user');
                        api.createUser(result[0].ipaddress, null, 'NHome', function(err, user) {
                            if (err) {
                                log('createUser: ' + err);
                                return;
                            }
                            clearInterval(registerInterval);
                            log('User ' + user + ' created');

                            // Connect with newly created user
                            api = new HueApi(result[0].ipaddress, user);

                            // Send username to web server
                            conn.emit('setConfig', { hue_apikey: user});

                            startListening();

                            loadLights();
                        });
                    }, 5000);

                } else {
                    log('Authentication ok');
                    startListening();
                    loadLights();
                }
            });

            function loadLights() {

                api.lights(function(err, reply) {
            
                    if (err) {
                        log('api.lights: ' + err);
                        return;
                    }
            
                    reply.lights.forEach(function(light) {
            
                        devices[result[0].id + ':' + light.id] = {
                            id: light.id,
                            name: light.name,
                            dev: api
                        };
                    });
                });
            }
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

    conn.on('setDeviceName', function (id, name) {
        setDeviceName(id, name);
    });
}

function sendBridgeInfo()
{
    conn.emit('bridgeInfo', { name: 'Hue' });
}

function getLights()
{
    var lights = [];

    for (device in devices) {
        lights.push({id: device, name: devices[device].name});
    }

    conn.emit('lights', {lights: lights});
}

// Deprecated
function setLightState(id, values)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var state = lightState.create();
    
    if (values.hasOwnProperty('rgb')) {
        state = state.rgb.apply(state, values.rgb);
        values.hue = state.hue;
        values.sat = state.sat;
        values.bri = state.bri;
        delete values.rgb;
    }

    devices[id].dev.setLightState(devices[id].id, values, function(err, result) {

        if (err) {
            log('api.setLightState:' + err);
            return;
        }

        if (result) {
            getLightState(id);
        }
    });
}

function setLightColor(id, color_string, color_format)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var state = lightState.create();
    
    try {
        var hsl = require('chroma-js')(color_string, color_format).hsl();
    } catch (e){
        log(e);
        return;
    }

    state.hsl(hsl[0] * 359, hsl[1] * 100, hsl[2] * 100).on();

    devices[id].dev.setLightState(devices[id].id, state, function(err, result) {

        if (err) {
            log('api.setLightColor:' + err);
            return;
        }

        if (result) {
            getLightState(id);
        }
    });
}

function setLightLevel(id, level)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var state = lightState.create();

    if (level > 0) {
        state.brightness(level).on();
    } else {
        state.off();
    }

    devices[id].dev.setLightState(devices[id].id, state, function(err, result) {

        if (err) {
            log('api.setLightLevel:' + err);
            return;
        }

        if (result) {
            getLightState(id);
        }
    });
}

function getLightState(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.lightStatus(devices[id].id, function(err, result) {
        if (err) {
            log('api.lightStatus: ' + err);
            return;
        }

        var hsl = [result.state.hue / 65534, result.state.sat / 254, result.state.bri / 254];
        var chroma = require('chroma-js')(hsl, 'hsl');

        var state = {
            on: result.state.on,
            level: parseInt((result.state.bri / 254) * 100),
            bri: result.state.bri, // deprecated
            hue: result.state.hue, // deprecated
            sat: result.state.sat, // deprecated
            hsl: chroma.hsl(),
            hsv: chroma.hsv(),
            rgb: chroma.rgb(),
            hex: chroma.hex()
        };

        conn.emit('lightState', { id: id, state: state });
    });
}

function setDeviceName(id, name)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setLightName(devices[id].id, name, function(err, result) {
        if (err) {
            log('api.setDeviceName: ' + err);
            return;
        }

        if (result) {
            devices[id].name = name;
            conn.emit('deviceRenamed', id, name);
        }
    });    
}
