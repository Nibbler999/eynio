"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {}, bridges = {};

var logger;

var dataRef;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Nest'});

    conn.emit('getOAuth2Token', 'nest', function(token) {

        if (token && token.access_token) {

            var Firebase = require('firebase');
            dataRef = new Firebase('wss://developer-api.nest.com');

            dataRef.authWithCustomToken(token.access_token, function(error) {

                if (error) {
                    console.error("Login Failed!", error);
                } else {

                    dataRef.on('value', function (snapshot) {

                        var data = snapshot.val();

                        function addThermostat(thermostat) {
                            
                            devices[thermostat] = {
                                id: thermostat,
                                name: data.structures[structure].name + ' ' + data.devices.thermostats[thermostat].name,
                                value: data.devices.thermostats[thermostat].ambient_temperature_c,
                                target: data.devices.thermostats[thermostat].target_temperature_c
                            };
                        }

                        for (var structure in data.structures) {
                            data.structures[structure].thermostats.forEach(addThermostat);
                        }

                        Namer.add(devices);
                    });

                    startListening();
                }
            });
        }
    });
};

function startListening()
{
    logger.info('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getThermostats', function (cb) {
        getThermostats(cb);
    });

    conn.on('getThermostatValue', function (id, cb) {
        getThermostatValue(id, cb);
    });
    
    conn.on('setThermostatValue', function (id, value, cb) {
        setThermostatValue(id, value, cb);
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

function getThermostats(cb)
{
    var thermostats = [];

    for (var device in devices) {
        thermostats.push({
            id: device,
            name: Namer.getName(device),
            value: devices[device].value,
            target: devices[device].target,
            categories: Cats.getCats(device)
        });
    }

    conn.emit('thermostats', thermostats);

    if (cb) cb(thermostats);
}

function getThermosetValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var thermosetValue = {
        id: id,
        name: Namer.getName(id),
        value: devices[id].value
    };

    conn.emit('thermosetValue', thermosetValue);

    if (cb) cb(thermosetValue);
}

function setThermostatValue(id, value, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var path = 'devices/thermostats/' + devices[id].id + '/target_temperature_c';
    
    dataRef.child(path).set(value, function (result) {
        if (result === null) {
            if (cb) cb(true);
        } else {
            if (cb) cb(result.message);
            logger.error(result.message);
        }
    }); 
}

