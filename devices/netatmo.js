"use strict";

var api;

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {}, bridges = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'netatmo'});

    conn.once('accepted', function () {
        getToken();
    });
};

function getToken()
{
    conn.emit('getOAuth2Token', 'netatmo', token_callback);
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

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getSensors', function (cb) {
        loadDevices(function() {
            getSensors(cb);
        });
    });

    conn.on('getSensorValue', function (id, cb) {
        getSensorValue(id, cb);
    });
}

function loadDevices(cb)
{
    api.getDevicelist(function(err, _devices, modules) {

        if (err) {
            logger.error('getDevicelist', err);
            return false;
        }

        _devices.forEach(function(device) {

            bridges[device._id] = 'netatmo';

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

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'netatmo', id: bridge });
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
            value: devices[device].value,
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

        conn.emit('sensorValue', sensorValue);
    
        if (cb) cb(sensorValue);
    });
}
