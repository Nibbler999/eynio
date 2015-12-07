"use strict";

var cfg = require('../configuration.js');
var Namer = require('./namer.js');
var _ = require('lodash');

var conn, logger, alarm_simple, triggered = {};

var Alarm = function (c, l) {

    conn = c;
    logger = l.child({component: 'Alarm'});

    alarm_simple = cfg.get('alarm_simple', { enabled: false, devices: [], recipients: [], method: 'gcm' });

    // temp
    if (alarm_simple.method === undefined) {
        alarm_simple.method = 'gcm';
        Alarm.save();
    }

    // temp
    if (alarm_simple.recipients === undefined) {
        alarm_simple.recipients = [];
        Alarm.save();
    }

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

    conn.on('setAlarmMethod', function (command) {
        setAlarmMethod.apply(command, command.args);
    });

    conn.on('setAlarmRecipients', function (command) {
        setAlarmRecipients.apply(command, command.args);
    });

    conn.on('addAlarmRecipient', function (command) {
        addAlarmRecipient.apply(command, command.args);
    });

    conn.on('removeAlarmRecipient', function (command) {
        removeAlarmRecipient.apply(command, command.args);
    });

    conn.on('getAlarmConfig', function (command) {
        getAlarmConfig.apply(command, command.args);
    });

    conn.on('alarmCheck', function (sensorValue) {

        try {
            var id = sensorValue.id;

            if (!alarm_simple.enabled || alarm_simple.devices.indexOf(id) === -1) {
                return;
            }

            var tripped = false;

            switch (sensorValue.type) {

            case 'motion':

                if (sensorValue.value > 0) {
                    tripped = true;
                }

                break;

            case 'noise':

                if (sensorValue.value > 80) {
                    tripped = true;
                }

                break;

            case 'door':
            case 'window':
            case 'smoke-alarm':

                if (sensorValue.value === true) {
                    tripped = true;
                }

                break;
            }

            if (tripped) {

                if (triggered.hasOwnProperty(id) && new Date() - triggered[id] < 10 * 1000) {
                    logger.debug('Alarm triggered by device', id, 'in last 10 seconds, ignoring it');
                    return;
                }

                var deviceName = Namer.getName(id);

                logger.info('Alarm triggered by device', deviceName);

                var event = {
                    device_name: deviceName,
                    datetime: Math.round(Date.now() / 1000)
                };

                conn.broadcast('alarmTriggered', event, alarm_simple);

                triggered[id] = new Date();
            }
        } catch (e) {
            logger.error(e);
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

function getAlarmConfig (cb)
{
    if (typeof cb === 'function') {
        cb(alarm_simple);
    }
}

function setAlarmMethod (method, cb)
{
    alarm_simple.method = method;
    Alarm.save();
    if (typeof cb === 'function') {
        cb(true);
    }
}

function setAlarmRecipients (recipients, cb)
{
    alarm_simple.recipients = recipients;
    Alarm.save();
    if (typeof cb === 'function') {
        cb(true);
    }
}

function addAlarmRecipient (recipient, cb)
{
    if (!_.contains(alarm_simple.recipients, recipient)) {
        alarm_simple.recipients.push(recipient);
    }

    Alarm.save();
    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeAlarmRecipient (recipient, cb)
{
    alarm_simple.recipients = _.without(alarm_simple.recipients, recipient);
    Alarm.save();
    if (typeof cb === 'function') {
        cb(true);
    }
}

Alarm.save = function () {
    cfg.set('alarm_simple', alarm_simple);
};

module.exports = Alarm;

