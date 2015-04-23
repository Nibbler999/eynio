"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn;

var lights = {}, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Insteon'});

    var html = '';

    require('http').get("http://connect.insteon.com/getinfo.asp", function(res) {

        res.on('data', function(d) {
            html += d.toString();
        });

        res.on('end', function() {

            var regex = /<a href="http:..([0-9.]+):25105">/;

            var matches = regex.exec(html);

            if (!matches) {
                return;
            }

            var host = matches[1];

            log('Hub found');

            var Insteon = require('home-controller').Insteon;

            var insteon = new Insteon();

            bridges['insteon:' + host] = insteon;

            insteon.on('error', function(err) {
                log(err);
            });

            insteon.connect(host, function() {

                log('Connected');

                insteon.links(function(error, info) {

                    info.forEach(function(device) {
                        insteon.info(device.id, function(error, info) {
                            if (info.isLighting) {
                                lights[device.id] = insteon.light(device.id);
                            }
                        });
                    });

                    Namer.add(lights);

                    startListening();
                });
            });

        });

    }).on('error', function(e) {
        console.log("Got error: " + e.message);
    });

};

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
        bridgeInfo.push({ name: 'Insteon', id: bridge });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getDevices(cb)
{
    var all = [];

    for (var device in lights) {
        all.push({
            id: device,
            name: Namer.getName(device),
            categories: Cats.getCats(device),
            type: 'light'
        });
    }

    if (cb) cb(all);
}

// deprecated
function setLightState(id, values)
{
    if (!lights.hasOwnProperty(id)) {
        return;
    }

    var light = lights[id];
    var self = this;

    if (values.hasOwnProperty('on')) {

        if (values.on) {
            light.turnOnFast(function(err) {
                if (err) {
                    log('light.turnOnFast: ' + err);
                    return;
                }

                self.log(Namer.getName(id), 'light-on');

                getLightState(id);
            });
        } else {
            light.turnOffFast(function(err) {
                if (err) {
                    log('light.turnOffFast: ' + err);
                    return;
                }

                self.log(Namer.getName(id), 'light-off');

                getLightState(id);
            });
        }
    }

    if (values.hasOwnProperty('bri')) {

        light.level(parseInt(values.bri, 10), function(err) {
            if (err) {
                log('light.level: ' + err);
                return;
            }
            getLightState(id);
        });
    }
}

function setDevicePowerState(id, on)
{
    setLightState(id, {on: on});
}

function getLightState(id, cb)
{
    if (!lights.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var light = lights[id];

    light.level(function(err, level) {
        var on = level > 0;
        var lightState = { on: on, level: level };
        conn.broadcast('lightState', { id: id, state: lightState});
        if (cb) cb(lightState);
    });
}
