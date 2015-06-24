"use strict";

var conn;

var logger;

var cfg = require('../configuration.js');

var Cats = require('../services/cats.js');

var remotes = {};

var remoteController = function (c, l) {

    conn = c;
    logger = l.child({component: 'Remotes'});

    remotes = cfg.get('itach_remotes', {}); // TODO: change name to generic

    conn.on('getCustomRemotes', function (command) {
        getCustomRemotes.apply(command, command.args);
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

        var r2 = JSON.parse(JSON.stringify(remotes[r]));

        if (r2.hasOwnProperty('keys')) {
            r2.keys = Object.keys(r2.keys);
        } else {
            r2.keys = [];
        }

        r2.categories = Cats.getCats(r);

        customremotes.push(r2);
    }

    conn.broadcast('customRemotes', customremotes);

    if (cb) cb(customremotes);
}

function saveRemotes()
{
    cfg.set('itach_remotes', remotes);
}

function saveCustomRemote(r)
{
    r.keys = {};
    r.id = require('node-uuid').v4();

    remotes[r.id] = r;

    saveRemotes();

    conn.broadcast('customRemoteAdded', r);
}

function updateCustomRemote(r)
{
    if (!remotes.hasOwnProperty(r.id)) {
        return;
    }

    r.keys = remotes[r.id].keys;

    remotes[r.id] = r;

    saveRemotes();

    conn.broadcast('customRemoteUpdated', r);
}

function deleteCustomRemote(id)
{
    delete remotes[id];

    saveRemotes();

    conn.broadcast('customRemoteDeleted', id);
}

function sendKey(remoteid, key, cb)
{
    var remote = remotes[remoteid];

    if (!remote) {
        logger.error('Unknown remote "' + remoteid + '"');
        if (cb) cb(false);
        return;
    }

    if (!remote.keys.hasOwnProperty(key)) {
        logger.error('Unknown key "' + key + '"');
        if (cb) cb(false);
        return;
    }

    conn.emit('sendRemoteKey', remote, key, cb);
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
        if (cb) cb(false);
        return;
    }

    conn.emit('learnRemoteKey', remote.deviceid, function (code) {
        saveCode(remoteid, key, code);
        if (cb) cb(true);
    });
}

module.exports = remoteController;

