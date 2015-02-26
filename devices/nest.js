"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, thermostats = {}, sensors = {}, bridges = {};

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

                            thermostats[thermostat] = {
                                id: thermostat,
                                name: data.structures[structure].name + ' ' + data.devices.thermostats[thermostat].name,
                                value: data.devices.thermostats[thermostat].ambient_temperature_c,
                                target: data.devices.thermostats[thermostat].target_temperature_c
                            };

                            sensors[thermostat + '-humidity'] = {
                                name: data.structures[structure].name + ' ' + data.devices.thermostats[thermostat].name + ' humidity',
                                type: 'humidity',
                                value: data.devices.thermostats[thermostat].humidity
                            };
                        }

                        for (var structure in data.structures) {
                            data.structures[structure].thermostats.forEach(addThermostat);
                        }

                        Namer.add(thermostats);
                        Namer.add(sensors);
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

function getThermostats(cb)
{
    var t = [];

    for (var device in thermostats) {
        t.push({
            id: device,
            name: Namer.getName(device),
            value: thermostats[device].value,
            target: thermostats[device].target,
            categories: Cats.getCats(device)
        });
    }

    conn.emit('thermostats', t);

    if (cb) cb(t);
}

function getThermostatValue(id, cb)
{
    if (!thermostats.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var thermostatValue = {
        id: id,
        name: Namer.getName(id),
        value: thermostats[id].value
    };

    conn.emit('thermostatValue', thermostatValue);

    if (cb) cb(thermostatValue);
}

function setThermostatValue(id, value, cb)
{
    if (!thermostats.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var path = 'devices/thermostats/' + thermostats[id].id + '/target_temperature_c';

    dataRef.child(path).set(value, function (result) {
        if (result === null) {
            if (cb) cb(true);
        } else {
            if (cb) cb(result.message);
            logger.error(result.message);
        }
    });
}

function getSensors(cb)
{
    var s = [];

    for (var device in sensors) {
        s.push({
            id: device,
            name: Namer.getName(device),
            type: sensors[device].type,
            categories: Cats.getCats(device)
        });
    }

    conn.emit('sensors', s);

    if (cb) cb(s);
}

function getSensorValue(id, cb)
{
    if (!sensors.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var sensorValue = {
        id: id,
        name: Namer.getName(id),
        type: sensors[id].type,
        value: sensors[id].value
    };

    conn.emit('sensorValue', sensorValue);

    if (cb) cb(sensorValue);
}
