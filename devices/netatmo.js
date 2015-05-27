"use strict";

var api;

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');
var cfg = require('../configuration.js');

var conn, devices = {}, bridges = {};

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

    conn.on('getSensorValue', function (command) {
        getSensorValue.apply(command, command.args);
    });
}

function loadDevices(cb)
{
    api.getDevicelist(function(err, _devices, modules) {

        if (err) {
            logger.error('getDevicelist', err);
            if (cb) cb();
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
        });

        modules.forEach(function(module) {

            if (blacklist.indexOf(module.main_device) !== -1) {
                return;
            }

            module.data_type.forEach(function(datatype) {

                devices[module.main_device + '-' + module._id + '-' + datatype] = {
                    id: module._id,
                    main_device: module.main_device,
                    type: datatype.toLowerCase(),
                    _type: datatype,
                    name: module.module_name + ' ' + datatype,
                    value: module.dashboard_data[datatype]
                };
            });
        });

        Namer.add(devices);

        if (cb) cb();
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

    if (cb) cb(bridgeInfo);
}

function getDevices(cb)
{
    var blacklist = cfg.get('blacklist_devices', []);

    loadDevices(function() {
        var all = [];

        for (var device in devices) {
            all.push({
                id: device,
                name: Namer.getName(device),
                type: 'sensor',
                subtype: devices[device].type,
                value: devices[device].value,
                categories: Cats.getCats(device),
                blacklisted: blacklist.indexOf(device) !== -1
            });
        }

        if (cb) cb(all);
    });
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
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
            if (cb) cb(null);
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

        if (cb) cb(sensorValue);
    });
}
