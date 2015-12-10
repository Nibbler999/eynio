"use strict";

var cfg = require('../configuration.js');

var conn, logger, deviceProperties = {}, userProperties = {}, activations = {}, usecount = {}, lastused = {};

var Props = function (c, l) {

    conn = c;
    logger = l.child({component: 'Props'});

    deviceProperties = cfg.get('device_properties', {});
    userProperties = cfg.get('device_userproperties', {});
    activations = cfg.get('device_activations', {});
    lastused = cfg.get('device_lastused', {});
    usecount = cfg.get('device_usecount', {});

    conn.on('setDeviceProperty', function (command) {
        setDeviceProperty.apply(command, command.args);
    });

    conn.on('removeDeviceProperty', function (command) {
        removeDeviceProperty.apply(command, command.args);
    });

    conn.on('setUserProperty', function (command) {
        setUserProperty.apply(command, command.args);
    });

    conn.on('removeUserProperty', function (command) {
        removeUserProperty.apply(command, command.args);
    });

    conn.on('appendActionLog', function (entry) {

        conn.send('appendActionLog', entry);

        activations[entry.id] = {
            'at': new Date(),
            'by': entry.user_name
        };

        if (entry.hasOwnProperty('user_id')) {

            if (!lastused[entry.id]) {
                lastused[entry.id] = {};
            }

            lastused[entry.id][entry.user_id] = new Date();
        }

        if (!usecount[entry.id]) {
            usecount[entry.id] = 0;
        }

        usecount[entry.id]++;

        cfg.setMulti({
            'device_activations': activations,
            'device_usecount': usecount,
            'device_lastused': lastused
        });
    });
};

function setDeviceProperty(device, property, value, cb)
{
    if (!deviceProperties[device]) {
        deviceProperties[device] = {};
    }

    deviceProperties[device][property] = value;

    Props.save();

    logger.debug('Device', device, 'property', property, 'set to', value);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeDeviceProperty(device, property, cb)
{
    if (deviceProperties[device]) {

        delete deviceProperties[device][property];

        Props.save();
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function setUserProperty(device, property, value, cb)
{
    if (!userProperties[device]) {
        userProperties[device] = {};
    }

    if (!userProperties[device][this.user_id]) {
        userProperties[device][this.user_id] = {};
    }

    userProperties[device][this.user_id][property] = value;

    Props.save();

    logger.debug('Device', device, 'user property', property, 'set to', value);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeUserProperty(device, property, cb)
{
    if (userProperties[device] && userProperties[device][this.user_id]) {

        delete userProperties[device][this.user_id][property];

        Props.save();
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

Props.save = function () {

    cfg.setMulti({
        'device_properties': deviceProperties,
        'device_userproperties': userProperties
    });
};

Props.getDeviceProperties = function (device) {
    return deviceProperties[device] || {};
};

Props.getUserProperties = function (device, user_id) {
    if (userProperties[device]) {
        return userProperties[device][user_id] || {};
    } else {
        return {};
    }
};

module.exports = Props;

