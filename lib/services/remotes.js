"use strict";

var conn;

var logger;

var cfg = require('../configuration.js');

var remotes = {};

var remoteController = function (c, l) {

    conn = c;
    logger = l.child({component: 'Remotes'});

    remotes = cfg.get('itach_remotes', {}); // TODO: change name to generic

    conn.on('getCustomRemotes', function (command) {
        getCustomRemotes.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('saveCustomRemote', function (command) {
        saveCustomRemote.apply(command, command.args);
    });

    conn.on('deleteCustomRemote', function (command) {
        deleteCustomRemote.apply(command, command.args);
    });

    conn.on('updateCustomRemote', function (command) {
        updateCustomRemote.apply(command, command.args);
    });

    conn.on('sendKey', function (command) {
        sendKey.apply(command, command.args);
    });

    conn.on('learnKey', function (command) {
        learnKey.apply(command, command.args);
    });
};

function getCustomRemotes(cb)
{
    var customremotes = [];

    for (var r in remotes) {
        customremotes.push(copyRemote(remotes[r]));
    }

    require('../common.js').addDeviceProperties.call(this, customremotes);

    conn.broadcast('customRemotes', customremotes);

    if (typeof cb === 'function') {
        cb(customremotes);
    }
}

function getDevices(cb)
{
    var remotes_array = hash_to_array(remotes);

    remotes_array.forEach(function (remote) {

        if (remote.type) {
            remote.subtype = remote.type;
        }

        remote.type = 'remote';

        if (remote.hasOwnProperty('keys')) {
            remote.keys = Object.keys(remote.keys);
        } else {
            remote.keys = [];
        }
    });

    require('../common.js').addDeviceProperties.call(this, remotes_array);

    if (typeof cb === 'function') {
        cb(remotes_array);
    }
}

function saveRemotes()
{
    cfg.set('itach_remotes', remotes);
    cfg.set('remotes', remotes);
}

function saveCustomRemote(r, cb)
{
    r.keys = {};
    r.id = require('node-uuid').v4();

    remotes[r.id] = r;

    saveRemotes();

    var r2 = copyRemote(r);

    if (r2.type) {
        r2.subtype = r2.type;
    }

    r2.type = 'remote';

    r2.categories = [];

    conn.broadcast('customRemoteAdded', r2);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function updateCustomRemote(remote, cb)
{
    if (!remotes.hasOwnProperty(remote.id)) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    for (var prop in remote) {
        if (prop !== 'keys') {
            remotes[remote.id][prop] = remote[prop];
        }
    }

    saveRemotes();

    conn.broadcast('customRemoteUpdated', copyRemote(remotes[remote.id]));

    if (typeof cb === 'function') {
        cb(true);
    }
}

function deleteCustomRemote(id, cb)
{
    if (!remotes.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    delete remotes[id];

    saveRemotes();

    conn.broadcast('customRemoteDeleted', id);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function sendKey(remoteid, key, cb)
{
    var remote = remotes[remoteid];

    if (!remote) {
        logger.error('Unknown remote "' + remoteid + '"');
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    if (!remote.keys.hasOwnProperty(key)) {
        logger.error('Unknown key "' + key + '"');
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var code = remote.keys[key];

    conn.emit('sendRemoteKey', remote, code, cb);
}

function saveCode(remoteid, key, code)
{
    if (!remotes.hasOwnProperty(remoteid)) {
        logger.error('Unknown remote "' + remoteid + '"');
        return;
    }

    remotes[remoteid].keys[key] = code;

    conn.broadcast('IRKeyLearned', { remoteid: remoteid, key: key });

    saveRemotes();
}

function learnKey(remoteid, key, cb)
{
    var remote = remotes[remoteid];

    if (!remote) {
        logger.error('Unknown remote "' + remoteid + '"');
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    conn.emit('learnRemoteKey', remote.deviceid, function (code) {
        if (code) {
            saveCode(remoteid, key, code);
            if (typeof cb === 'function') {
                cb(true);
            }
        }
    });
}

function copyRemote(remote)
{
    var r2 = JSON.parse(JSON.stringify(remote));

    if (r2.hasOwnProperty('keys')) {
        r2.keys = Object.keys(r2.keys);
    } else {
        r2.keys = [];
    }

    return r2;
}

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

module.exports = remoteController;

