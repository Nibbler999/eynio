"use strict";

var cfg = require('../configuration.js');

var conn, logger, properties = {}, activations = {};

var Props = function (c, l) {

    conn = c;
    logger = l.child({component: 'Props'});

    properties = cfg.get('device_properties', {});
    activations = cfg.get('device_activations', {});

    conn.on('setDeviceProperty', function (command) {
        setDeviceProperty.apply(command, command.args);
    });

    conn.on('removeDeviceProperty', function (command) {
        removeDeviceProperty.apply(command, command.args);
    });

    conn.on('appendActionLog', function (entry) {

        conn.send('appendActionLog', entry);

        activations[entry.id] = {
            'at': new Date(),
            'by': entry.user
        };

        cfg.set('device_activations', activations);
    });
};

function setDeviceProperty(device, property, value, cb)
{
    if (!properties[device]) {
        properties[device] = {};
    }

    properties[device][property] = value;

    Props.save();

    logger.debug('Device', device, 'property', property, 'set to', value);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeDeviceProperty(device, property, cb)
{
    if (properties[device]) {

        delete properties[device][property];

        Props.save();
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

Props.save = function () {
    cfg.set('device_properties', properties);
};

Props.get = function (device) {
    return properties[device] || {};
};

module.exports = Props;

