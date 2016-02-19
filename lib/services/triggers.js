"use strict";

var cfg = require('../configuration.js');

var conn, logger, triggerlist = {};

var Triggers = function (c, l) {

    conn = c;
    logger = l.child({component: 'Triggers'});

    triggerlist = cfg.get('triggerlist', {});

    conn.on('addTrigger', function (command) {
        addTrigger.apply(command, command.args);
    });

    conn.on('deleteTrigger', function (command) {
        deleteTrigger.apply(command, command.args);
    });

    conn.on('getTriggers', function (command) {
        getTriggers.apply(command, command.args);
    });

    conn.on('switchState', function (state) {
        applyTrigger('switch', state);
    });

    conn.on('sensorValue', function (state) {
        applyTrigger('sensor', state);
    });
};

function addTrigger(trigger, cb)
{
    trigger.id = require('node-uuid').v4();

    triggerlist[trigger.id] = trigger;

    Triggers.save();

    logger.debug('Trigger', trigger.id, 'added');

    conn.broadcast('triggerAdded', trigger);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function deleteTrigger(triggerid, cb)
{
    delete triggerlist[triggerid];

    conn.broadcast('triggerDeleted', triggerid);

    Triggers.save();

    logger.debug('Trigger', triggerid, 'deleted');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function applyTrigger(type, state)
{
    var trigger;

    for (var id in triggerlist) {

        trigger = triggerlist[id];

        if (trigger.test.deviceid === state.id) {

            if (type === 'switch') {

                if (trigger.test.power_state === state.state.on) {
                    applyAction(id);
                }

            } else if (type === 'sensor') {

                if (trigger.test.value === state.value) {
                    applyAction(id);
                }
            }
        }
    }
}

function applyAction(triggerid)
{
    logger.debug('Applying action for trigger', triggerid);

    var trigger = triggerlist[triggerid];

    var command = {
        name: trigger.action.emit_name,
        args: trigger.action.params
    };

    command.log = function (deviceid, devicename, action) {

        var entry = {
            user_name: trigger.name,
            id: deviceid,
            device: devicename,
            action: action
        };

        conn.emit('appendActionLog', entry);
    };

    conn.emit(command.name, command);

    if (trigger.once) {
        deleteTrigger(triggerid);
    }
}

function getTriggers(cb)
{
    var trigger_array = hash_to_array(triggerlist);

    if (typeof cb === 'function') {
        cb(trigger_array);
    }
}

Triggers.save = function () {
    cfg.set('triggerlist', triggerlist);
};

function hash_to_array(hash)
{
    var array = [], object;

    for (var key in hash) {

        object = {
            id: key
        };

        for (var key2 in hash[key]) {
            object[key2] = hash[key][key2];
        }

        array.push(object);
    }

    return array;
}

module.exports = Triggers;

