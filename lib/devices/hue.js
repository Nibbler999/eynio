"use strict";

var hue = require("node-hue-api");

var HueApi = hue.HueApi,
    lightState = hue.lightState;

var cfg = require('../configuration.js');

var conn, devices = {}, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Hue'});

    hue.nupnpSearch(function(search_err, result) {

        if (search_err) {
            log('locateBridges: ' + search_err);
            return;
        }

        if (result.length === 0) {
            return;
        }
        var tcpp = require('tcp-ping');

        result.forEach(function (res) {

            tcpp.probe(res.ipaddress, 80, function (err, available) {

                if (err) {
                    logger.debug(err);
                }

                if (available) {
                    log('Found a bridge');
                    loadBridge(res);
                } else {
                    logger.debug('Found ip', res.ipaddress, 'but it was not reachable');
                }
            });
        });

        loadLights();
    });
};

function loadBridge(bridge)
{
    var hue_apikey = cfg.get('hue_apikey_' + bridge.id, 'none');

    // temporary migration
    if (hue_apikey === 'none') {

        hue_apikey = cfg.get('hue_apikey', 'none');

        if (hue_apikey !== 'none') {
            cfg.set('hue_apikey_' + bridge.id, hue_apikey);
        }
    }

    var api = new HueApi(bridge.ipaddress, hue_apikey);

    bridges[bridge.id] = { api: api };

    api.config(function(config_err, config) {

        if (config_err) {
            log(config_err);
            return;
        }

        bridges[bridge.id].name = config.name;

        // If auth failed this property is missing
        if (!config.hasOwnProperty('ipaddress')) {

            log('Need to create user');
            conn.broadcast('pushthebutton', config.name);

            var registerInterval = setInterval(function () {
                //log('Creating user');
                api.createUser(bridge.ipaddress, 'Eynio', function(createUser_err, user) {
                    if (createUser_err) {
                        //log('createUser: ' + createUser_err);
                        return;
                    }
                    clearInterval(registerInterval);
                    log('User ' + user + ' created');

                    // Connect with newly created user
                    bridges[bridge.id].api = new HueApi(bridge.ipaddress, user);

                    // Send username to web server
                    cfg.set('hue_apikey_' + bridge.id, user);

                    startListening();
                });
            }, 5000);

        } else {
            log('Authentication ok');
            startListening();
        }
    });
}

function loadLights(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var numresults = 0;

    var done = function () {

        if (++numresults === Object.keys(bridges).length) {
            if (typeof cb === 'function') {
                cb();
            }
        }
    };

    for (var bridge in bridges) {

        if (blacklist.indexOf(bridge) !== -1) {
            done();
            continue;
        }

        loadBridgeLights(bridge, done);
    }
}

function loadBridgeLights(bridge, done)
{
    bridges[bridge].api.lights(function(err, reply) {

        if (err) {
            log('api.lights: ' + err);
            done();
            return;
        }

        reply.lights.forEach(function (light) {
            addLight(bridge, light);
        });

        done();
    });
}

function addLight(bridge, light)
{
    var state = null;

    if (light.hasOwnProperty('state')) {

        if (!light.state.reachable) {
            return;
        }

        var hsl = [(light.state.hue / 65534) * 359, light.state.sat / 254, light.state.bri / 254];
        var chroma = require('chroma-js')(hsl, 'hsl');

        state = {
            on: light.state.on,
            level: parseInt((light.state.bri / 254) * 100, 10),
            hsl: chroma.hsl(),
            hsv: chroma.hsv(),
            rgb: chroma.rgb(),
            hex: chroma.hex()
        };
    }

    devices[bridge + ':' + light.id] = {
        id: light.id,
        name: light.name,
        dev: bridges[bridge].api
    };

    if (state) {
        devices[bridge + ':' + light.id].state = state;
    }
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

    conn.on('setDeviceName', function (command) {
        setDeviceName.apply(command, command.args);
    });

    conn.on('addNewDevices', function (command) {
        addNewDevices.apply(command, command.args);
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

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: bridges[bridge].name,
            module: 'hue',
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
    loadLights(function() {

        var all = [];

        for (var device in devices) {
            all.push({
                id: device,
                name: devices[device].name,
                state: devices[device].state,
                type: 'light',
                module: 'hue'
            });
        }

        if (typeof cb === 'function') {
            cb(all);
        }
    });
}

// Deprecated
function setLightState(id, values, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
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

    var self = this;

    devices[id].dev.setLightState(devices[id].id, values, function(err, result) {

        if (err) {
            log('api.setLightState:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (result) {

            if (values.on) {
                self.log(id, devices[id].name, 'light-on');
            } else {
                self.log(id, devices[id].name, 'light-off');
            }

            getLightState(id, function (state) {
                conn.broadcast('lightState', { id: id, state: state });
            });

            if (typeof cb === 'function') {
                cb(true);
            }
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

    var state = lightState.create();

    var hsv;

    try {
        hsv = require('chroma-js')(color_string, color_format).hsv();
    } catch (e) {
        log(e);
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    state.hsb(hsv[0], hsv[1] * 100, hsv[2] * 100).on();

    devices[id].dev.setLightState(devices[id].id, state, function(err, result) {

        if (err) {
            log('api.setLightColor:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (result) {
            getLightState(id, function (state) {
                conn.broadcast('lightState', { id: id, state: state });
            });
            if (typeof cb === 'function') {
                cb(true);
            }
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

    temperature = ((temperature * 346) / 100) + 154;

    var state = lightState.create();

    state.hsb(0, 0, 0).white(temperature, brightness).on();

    devices[id].dev.setLightState(devices[id].id, state, function(err, result) {

        if (err) {
            log('api.setLightWhite:' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (result) {
            getLightState(id, function (state) {
                conn.broadcast('lightState', { id: id, state: state });
            });
            if (typeof cb === 'function') {
                cb(true);
            }
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

    devices[id].dev.lightStatus(devices[id].id, function(err, result) {

        if (err) {
            log('api.lightStatus: ' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var hsl = [(result.state.hue / 65534) * 359, result.state.sat / 254, result.state.bri / 254];
        var chroma = require('chroma-js')(hsl, 'hsl');

        var state = {
            on: result.state.on,
            level: parseInt((result.state.bri / 254) * 100, 10),
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
            conn.broadcast('deviceRenamed', id, name);
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
