"use strict";

var api;

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {}, bridges = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Nest'});

    conn.once('accepted', function (cfg) {

        conn.emit('getOAuth2Token', 'nest', function(token) {

            if (token.access_token) {

                var Firebase = require('firebase');
                var dataRef = new Firebase('wss://developer-api.nest.com');

                dataRef.authWithCustomToken(token.access_token, function(error, authData) {

                    if (error) {
                        console.error("Login Failed!", error);
                    } else {

                        dataRef.on('value', function (snapshot) {

                            var data = snapshot.val();

                            for (var structure in data.structures) {
                               
                                data.structures[structure].thermostats.forEach(function(thermostat) {

                                    devices[thermostat] = {
                                        id: thermostat,
                                        name: data.structures[structure].name + ' ' + data.devices.thermostats[thermostat].name,
                                        type: 'temperature',
                                        value: data.devices.thermostats[thermostat].ambient_temperature_c
                                    };
                                });
                            }

                            Namer.add(devices);
                        });

                        startListening();
                    }
                });
            }
        });
    });
};

function startListening()
{
    logger.info('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getSensors', function (cb) {
        getSensors(cb);
    });

    conn.on('getSensorValue', function (id, cb) {
        getSensorValue(id, cb);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'nest', id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getSensors(cb)
{
    var sensors = [];

    for (var device in devices) {
        sensors.push({
            id: device,
            name: Namer.getName(device),
            type: devices[device].type,
            categories: Cats.getCats(device)
        });
    }

    conn.emit('sensors', sensors);

    if (cb) cb(sensors);
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var sensorValue = {
        id: id,
        name: Namer.getName(id),
        type: devices[id].type,
        value: devices[id].value
    };

    conn.emit('sensorValue', sensorValue);

    if (cb) cb(sensorValue);
}
