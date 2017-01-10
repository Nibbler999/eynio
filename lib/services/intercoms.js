"use strict";

var conn;

var logger;

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var includes = require('lodash/includes');
var without = require('lodash/without');

var intercoms = {};

var IntercomController = function(c, l) {

    conn = c;
    logger = l.child({component: 'Intercoms'});

    intercoms = cfg.get('intercoms', {});

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('addIntercom', function (command) {
        addIntercom.apply(command, command.args);
    });

    conn.on('updateIntercom', function (command) {
        updateIntercom.apply(command, command.args);
    });

    conn.on('deleteIntercom', function (command) {
        deleteIntercom.apply(command, command.args);
    });

    conn.on('addIntercomBellRecipient', function (command) {
        addIntercomBellRecipient.apply(command, command.args);
    });

    conn.on('removeIntercomBellRecipient', function (command) {
        removeIntercomBellRecipient.apply(command, command.args);
    });
}

function getDevices(cb)
{
    var intercoms_array = hash_to_array(intercoms);

    intercoms_array.forEach(function (intercom) {
        intercom.type = 'intercom';
    });

    require('../common.js').addDeviceProperties.call(this, intercoms_array);

    if (typeof cb === 'function') {
        cb(intercoms_array);
    }
}

function addIntercom(intercom, cb)
{
    intercom.id = require('uuid/v4')();

    if (!intercom.recipients) {
        intercom.recipients = [];
    }

    intercoms[intercom.id] = intercom;

    cfg.set('intercoms', intercoms);

    logger.debug('Intercom', intercom.id, 'added');

    conn.broadcast('intercomAdded', intercom);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function updateIntercom(intercom, cb)
{
    for (var prop in intercom) {
        intercoms[intercom.id][prop] = intercom[prop];
    }

    cfg.set('intercoms', intercoms);

    logger.debug('Intercom', intercom.id, 'updated');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function deleteIntercom(id, cb)
{
    delete intercoms[id];

    cfg.set('intercoms', intercoms);

    logger.debug('Intercom', id, 'deleted');

    conn.broadcast('intercomDeleted', id);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function addIntercomBellRecipient (id, recipient, cb)
{
    if (!includes(intercoms[id].recipients, recipient)) {
        intercoms[id].recipients.push(recipient);
    }

    cfg.set('intercoms', intercoms);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeIntercomBellRecipient (id, recipient, cb)
{
    intercoms[id].recipients = without(intercoms[id].recipients, recipient);

    cfg.set('intercoms', intercoms);

    if (typeof cb === 'function') {
        cb(true);
    }
}

module.exports = IntercomController;

