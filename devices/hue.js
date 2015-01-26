
var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var conn, devices = {}, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Hue'});

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

            bridges[result[0].id] = { api: api };

            api.config(function(err, config) {

                if (err) {
                    log(err);
                    return;
                }
    
                bridges[result[0].id].name = config.name;
            });

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

                            loadLights(result[0].id);
                        });
                    }, 5000);

                } else {
                    log('Authentication ok');
                    startListening();
                    loadLights(result[0].id);
                }
            });
        });
    });
}

function loadLights(id)
{
    bridges[id].api.lights(function(err, reply) {

        if (err) {
            log('api.lights: ' + err);
            return;
        }

        reply.lights.forEach(function(light) {

            if (!light.reachable) {
                return;
            }

            devices[id + ':' + light.id] = {
                id: light.id,
                name: light.name,
                dev: bridges[id].api
            };
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

    conn.on('getLightState', function (id, cb) {
        getLightState(id, cb);
    });

    conn.on('setDeviceName', function (id, name) {
        setDeviceName(id, name);
    });

    conn.on('addNewDevices', function (id) {
        addNewDevices(id);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: bridges[bridge].name, id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getLights(cb)
{
    var lights = [];

    for (var device in devices) {
        lights.push({id: device, name: devices[device].name});
    }

    conn.emit('lights', lights);

    if (cb) cb(lights);
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

    state.hsl(hsl[0], hsl[1] * 100, hsl[2] * 100).on();

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

function setLightWhite(id, brightness, temperature)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    temperature = ((temperature * 346) / 100) + 154;

    var state = lightState.create();

    state.hsl(0, 0, 0).white(temperature, brightness).on();

    devices[id].dev.setLightState(devices[id].id, state, function(err, result) {

        if (err) {
            log('api.setLightWhite:' + err);
            return;
        }

        if (result) {
            getLightState(id);
        }
    });
}

function getLightState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    devices[id].dev.lightStatus(devices[id].id, function(err, result) {

        if (err) {
            log('api.lightStatus: ' + err);
            if (cb) cb(null);
            return;
        }

        var hsl = [(result.state.hue / 65534) * 359, result.state.sat / 254, result.state.bri / 254];
        var chroma = require('chroma-js')(hsl, 'hsl');

        var state = {
            on: result.state.on,
            hsl: chroma.hsl(),
            hsv: chroma.hsv(),
            rgb: chroma.rgb(),
            hex: chroma.hex()
        };

        conn.emit('lightState', { id: id, state: state });

        if (cb) cb(state);
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

function addNewDevices(id)
{
    bridges[id].api.searchForNewLights(function(err, result) {

        if (err) {
            log('api.searchForNewLights: ' + err);
            return;
        }

        if (result) {
            setTimeout(function() {
                loadLights(id);
            }, 65000);
        }
    });
}
