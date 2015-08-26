"use strict";

var Namer = require('../services/namer.js');
var cfg = require('../configuration.js');

var conn, thermostats = {}, sensors = {}, bridges = {};

var logger;

var dataRef;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Nest'});

    conn.send('getOAuth2Token', 'nest', function(token) {

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

                            // Broadcast change
                            getThermostatValue(thermostat);

                            sensors[thermostat + '-humidity'] = {
                                name: data.structures[structure].name + ' ' + data.devices.thermostats[thermostat].name + ' humidity',
                                type: 'humidity',
                                value: data.devices.thermostats[thermostat].humidity
                            };
                        }

                        function addSmokeAlarm(alarm) {

                            sensors[alarm + '-smoke'] = {
                                name: data.structures[structure].name + ' ' + data.devices.smoke_co_alarms[alarm].name + ' Smoke',
                                type: 'smoke-alarm',
                                value: data.devices.smoke_co_alarms[alarm].smoke_alarm_state !== 'ok'
                            };

                            sensors[alarm + '-co'] = {
                                name: data.structures[structure].name + ' ' + data.devices.smoke_co_alarms[alarm].name + ' CO',
                                type: 'co-alarm',
                                value: data.devices.smoke_co_alarms[alarm].co_alarm_state !== 'ok'
                            };
                        }

                        var blacklist = cfg.get('blacklist_bridges', []);

                        thermostats = {};
                        sensors = {};

                        for (var structure in data.structures) {

                            bridges[structure] = true;

                            if (blacklist.indexOf(structure) !== -1) {
                                continue;
                            }

                            if (data.structures[structure].thermostats && data.devices.thermostats) {
                                data.structures[structure].thermostats.forEach(addThermostat);
                            }

                            if (data.structures[structure].smoke_co_alarms && data.devices.smoke_co_alarms) {
                                data.structures[structure].smoke_co_alarms.forEach(addSmokeAlarm);
                            }
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

    conn.on('getBridges', function (command) {
        getBridges.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('getThermostatValue', function (command) {
        getThermostatValue.apply(command, command.args);
    });

    conn.on('setThermostatValue', function (command) {
        setThermostatValue.apply(command, command.args);
    });

    conn.on('getSensorValue', function (command) {
        getSensorValue.apply(command, command.args);
    });
}

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: 'nest',
            module: 'nest',
            id: bridge,
            ip: null,
            mac: null,
            blacklisted: blacklist.indexOf(bridge) !== -1
        });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getDevices(cb)
{
    var all = [];

    for (var device in thermostats) {
        all.push({
            id: device,
            name: Namer.getName(device),
            value: thermostats[device].value,
            target: thermostats[device].target,
            type: 'thermostat',
            module: 'nest'
        });
    }

    for (device in sensors) {
        all.push({
            id: device,
            name: Namer.getName(device),
            value: sensors[device].value,
            type: 'sensor',
            subtype: sensors[device].type,
            module: 'nest'
        });
    }

    require('../common.js').addDeviceProperties(all);

    if (cb) cb(all);
}

function getThermostatValue(id, cb)
{
    if (!thermostats.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var thermostatValue = {
        id: id,
        name: Namer.getName(id),
        value: thermostats[id].value,
        target: thermostats[id].target
    };

    conn.broadcast('thermostatValue', thermostatValue);

    if (cb) cb(thermostatValue);
}

function setThermostatValue(id, value, cb)
{
    if (!thermostats.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var self = this;

    var path = 'devices/thermostats/' + thermostats[id].id + '/target_temperature_c';

    dataRef.child(path).set(value, function (result) {
        if (result === null) {
            self.log(Namer.getName(id), 'thermostat-set');
            if (cb) cb(true);
        } else {
            if (cb) cb(result.message);
            logger.error(result.message);
        }
    });
}

function getSensorValue(id, cb)
{
    if (!sensors.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var sensorValue = {
        id: id,
        name: Namer.getName(id),
        type: sensors[id].type,
        value: sensors[id].value
    };

    conn.broadcast('sensorValue', sensorValue);

    if (cb) cb(sensorValue);
}
