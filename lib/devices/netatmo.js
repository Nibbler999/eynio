"use strict";

var api;

var Namer = require('../services/namer.js');
var cfg = require('../configuration.js');

var conn, devices = {}, bridges = {}, thermostats = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'netatmo'});

    getToken();
};

function getToken()
{
    conn.send('getOAuth2Token', 'netatmo', token_callback);
}

function token_callback(token)
{
    if (token && token.access_token) {

        if (api) {
            api.authenticate(token);
        } else {

            var Netatmo = require('netatmo');

            api = new Netatmo(token);

            api.on("error", function(error) {
                logger.error(error);
            });

            loadDevices(startListening);
        }

        if (token.expires_in > 0) {
            setTimeout(getToken, token.expires_in * 1000);
        }
    }
}

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

function loadDevices(cb)
{
    var count = 2;

    var both = function() {
        if (--count === 0) {
            cb();
        }
    };

    getStations(both);
    getThermostats(both);
}

function getStations(cb)
{
    api.getStations(function(err, _devices) {

        if (err) {
            logger.error('getDevicelist', err);
            if (typeof cb === 'function') {
                cb();
            }
            return false;
        }

        var blacklist = cfg.get('blacklist_bridges', []);

        devices = {};

        _devices.forEach(function(device) {

            bridges[device._id] = 'netatmo';

            if (blacklist.indexOf(device._id) !== -1) {
                return;
            }

            device.data_type.forEach(function(datatype) {

                devices[device._id + '-' + datatype] = {
                    id: device._id,
                    type: datatype.toLowerCase(),
                    _type: datatype,
                    name: device.module_name + ' ' + datatype,
                    value: device.dashboard_data[datatype === 'Co2' ? 'CO2' : datatype]
                };
            });

            device.modules.forEach(function(module) {

                module.data_type.forEach(function(datatype) {

                    devices[device._id + '-' + module._id + '-' + datatype] = {
                        id: module._id,
                        main_device: device._id,
                        type: datatype.toLowerCase(),
                        _type: datatype,
                        name: module.module_name + ' ' + datatype,
                        value: module.dashboard_data[datatype]
                    };
                });
            });
        });

        Namer.add(devices);

        if (typeof cb === 'function') {
            cb();
        }
    });
}

function getThermostats(cb)
{
    api.getThermostats(function(err, _devices) {

        if (err) {
            logger.error('getDevicelist', err);
            if (typeof cb === 'function') {
                cb();
            }
            return false;
        }

        var blacklist = cfg.get('blacklist_bridges', []);

        thermostats = {};

        _devices.forEach(function(device) {

            if (blacklist.indexOf(device._id) !== -1) {
                return;
            }

            device.modules.forEach(function(module) {

                thermostats[device._id + '-' + module._id] = {
                    id: device._id + '-' + module._id,
                    device_id: device._id,
                    name: device.station_name,
                    value: module.measured.temperature,
                    target: module.setpoint.setpoint_temp
                };
            });
        });

        Namer.add(thermostats);

        if (typeof cb === 'function') {
            cb();
        }
    });
}

function setThermostatValue(id, value, cb)
{
    if (!thermostats.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var options = {
        device_id: thermostats[id].device_id,
        module_id: thermostats[id].id,
        setpoint_mode: 'manual',
        setpoint_temp: value,
        setpoint_endtime: Math.floor(Date.now() / 1000) + 3600
    };

    var self = this;

    api.setThermpoint(options, function(err, result) {

        if (err) {
            logger.error(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (result !== 'ok') {
            logger.error(result);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (typeof cb === 'function') {
            cb(true);
        }

        self.log(id, Namer.getName(id), 'thermostat-set');
    });
}

function getThermostatValue(id, value, cb)
{
    if (!thermostats.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var options = {
        device_id: thermostats[id].device_id,
        module_id: thermostats[id].id
    };

    api.getThermstate(options, function(err, status) {

        if (err) {
            logger.error(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var thermostatValue = {
            id: id,
            name: Namer.getName(id),
            value: status.measured.temperature,
            target: status.measured.setpoint_temp
        };

        conn.broadcast('thermostatValue', thermostatValue);

        if (typeof cb === 'function') {
            cb(thermostatValue);
        }
    });
}

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: 'netatmo',
            module: 'netatmo',
            id: bridge,
            ip: null,
            mac: null,
            blacklisted: blacklist.indexOf(bridge) !== -1
        });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (typeof cb === 'function') {
        cb(bridgeInfo);
    }
}

function getDevices(cb)
{
    var self = this;

    loadDevices(function() {

        var all = [];

        for (var device in devices) {
            all.push({
                id: device,
                name: Namer.getName(device),
                type: 'sensor',
                subtype: devices[device].type,
                value: devices[device].value,
                module: 'netatmo'
            });
        }

        for (device in thermostats) {
            all.push({
                id: device,
                name: Namer.getName(device),
                value: thermostats[device].value,
                target: thermostats[device].target,
                type: 'thermostat',
                module: 'netatmo'
            });
        }

        require('../common.js').addDeviceProperties.call(self, all);

        if (typeof cb === 'function') {
            cb(all);
        }
    });
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var options = {
        scale: 'max',
        type: devices[id]._type,
        date_end: 'last'
    };

    if (devices[id].hasOwnProperty('main_device')) {
        options.device_id = devices[id].main_device;
        options.module_id = devices[id].id;
    } else {
        options.device_id = devices[id].id;
    }

    api.getMeasure(options, function(err, measure) {

        if (err) {
            logger.error('getSensorValue', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var sensorValue = {
            id: id,
            name: Namer.getName(id),
            type: devices[id].type,
            value: measure[0].value[0][0]
        };

        devices[id].value = sensorValue.value;

        conn.broadcast('sensorValue', sensorValue);

        if (typeof cb === 'function') {
            cb(sensorValue);
        }
    });
}
