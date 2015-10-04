"use strict";

var cfg = require('../configuration.js');
var Namer = require('./namer.js');

var conn, logger, alarm_simple, triggered = {};

var Alarm = function (c, l) {

    conn = c;
    logger = l.child({component: 'Alarm'});

    alarm_simple = cfg.get('alarm_simple', { enabled: false, devices: [] });

    conn.on('enableAlarm', function (command) {
        enableAlarm.apply(command, command.args);
    });

    conn.on('disableAlarm', function (command) {
        disableAlarm.apply(command, command.args);
    });

    conn.on('setAlarmDevices', function (command) {
        setAlarmDevices.apply(command, command.args);
    });

    conn.on('getAlarmDevices', function (command) {
        getAlarmDevices.apply(command, command.args);
    });

    conn.on('isAlarmEnabled', function (command) {
        isAlarmEnabled.apply(command, command.args);
    });

    conn.on('alarmCheck', function (id, value) {

        if (value > 0 && alarm_simple.enabled && alarm_simple.devices && alarm_simple.devices.indexOf(id) !== -1) {

            if (triggered.hasOwnProperty(id) && new Date() - triggered[id] < 10 * 1000) {
                logger.debug('Alarm triggered by device', id, 'in last 10 seconds, ignoring it');
                return;
            }

            var deviceName = Namer.getName(id);

            logger.info('Alarm triggered by device', deviceName);

            conn.broadcast('alarmTriggered', {id: id, name: deviceName});

            triggered[id] = new Date();
        }
    });
};

function enableAlarm (cb)
{
    alarm_simple.enabled = true;
    Alarm.save();
    if (typeof cb === 'function') {
        cb(true);
    }
}

function disableAlarm (cb)
{
    alarm_simple.enabled = false;
    Alarm.save();
    if (typeof cb === 'function') {
        cb(true);
    }
}

function setAlarmDevices (devices, cb)
{
    alarm_simple.devices = devices;
    Alarm.save();
    if (typeof cb === 'function') {
        cb(true);
    }
}

function getAlarmDevices (cb)
{
    if (typeof cb === 'function') {
        cb(alarm_simple.devices);
    }
}

function isAlarmEnabled (cb)
{
    if (typeof cb === 'function') {
        cb(alarm_simple.enabled);
    }
}

Alarm.save = function () {
    cfg.set('alarm_simple', alarm_simple);
};

module.exports = Alarm;
