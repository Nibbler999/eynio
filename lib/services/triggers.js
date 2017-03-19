"use strict";

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

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
    trigger.id = require('uuid/v4')();

    triggerlist[trigger.id] = trigger;

    logger.debug('Trigger', trigger.id, 'added');

    conn.broadcast('triggerAdded', trigger);

    cfg.set('triggerlist', triggerlist, cb);
}

function deleteTrigger(triggerid, cb)
{
    delete triggerlist[triggerid];

    conn.broadcast('triggerDeleted', triggerid);

    logger.debug('Trigger', triggerid, 'deleted');

    cfg.set('triggerlist', triggerlist, cb);
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

module.exports = Triggers;

