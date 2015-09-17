"use strict";

var cfg = require('../configuration.js');

var conn, logger, alarm_simple;

var Alarm = function (c, l) {

    conn = c;
    logger = l.child({component: 'Alarm'});

    alarm_simple = cfg.get('alarm_simple', {});

    conn.on('enableAlarm', function (command) {
        enableAlarm.apply(command, command.args);
    });

    conn.on('disableAlarm', function (command) {
        disableAlarm.apply(command, command.args);
    });

    conn.on('setAlarmDevices', function (command) {
        setAlarmDevices.apply(command, command.args);
    });

    conn.on('alarmCheck', function (id, value) {

        if (value > 0 && alarm_simple.enabled && alarm_simple.devices && alarm_simple.devices.indexOf(id) !== -1) {
            logger.info('Alarm triggered');
        }
    });
};

function enableAlarm (cb)
{
    alarm_simple.enabled = true;
    Alarm.save();
    if (cb) cb(true);
}

function disableAlarm (cb)
{
    alarm_simple.enabled = false;
    Alarm.save();
    if (cb) cb(true);
}

function setAlarmDevices (devices, cb)
{
    alarm_simple.devices = devices;
    Alarm.save();
    if (cb) cb(true);
}

Alarm.save = function () {
    cfg.set('alarm_simple', alarm_simple);
};

module.exports = Alarm;

