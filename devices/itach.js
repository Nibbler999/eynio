"use strict";

var Itach = require('simple-itach');

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn;

var devices = {};

var remotes = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'iTach'});

    conn.once('accepted', function (cfg) {

        if (cfg.itach_remotes) {
            remotes = JSON.parse(cfg.itach_remotes);
        }

        var d = new Itach.discovery();

        d.on('device', function(device) {

            if (!devices.hasOwnProperty(device.UUID)) {

                log('Discovered device');

                devices[device.UUID] = {
                    name: device.Model,
                    dev: new Itach(device.host)
                };

                Namer.add(devices);
            }
        });

        d.once('device', function() {
            startListening();
        });
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getRemotes', function (cb) {
        getRemotes(cb);    
    });
    
    conn.on('sendRemoteCommand', function (id, cmd, cb) {
        sendRawCommand(id, cmd, cb);
    });

    conn.on('sendKey', function (remoteid, key, cb) {
        sendKey(remoteid, key, cb);
    });

    conn.on('learnKey', function (remoteid, key) {
        learnKey(remoteid, key);
    });

    conn.on('saveCustomRemote', function (remote) {
        saveCustomRemote(remote);
    });

    conn.on('deleteCustomRemote', function (remoteid) {
        deleteCustomRemote(remoteid);
    });

    conn.on('updateCustomRemote', function (remote) {
        updateCustomRemote(remote);
    });

    conn.on('getCustomRemotes', function (cb) {
        getCustomRemotes(cb);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var device in devices) {
        bridgeInfo.push({ name: Namer.getName(device), id: device });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getRemotes(cb)
{
    var remotes = [];

    for (var device in devices) {
        remotes.push({
            id: device,
            name: Namer.getName(device),
            categories: Cats.getCats(device)
        });
    }

    conn.emit('remotes', remotes);

    if (cb) cb(remotes);
}

function sendRawCommand(id, cmd, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    devices[id].dev.send(cmd, function (err, res) {
        if (err) {
            log(err);
            if (cb) cb(false);
            return;
        }
        if (cb) cb(true);
    });
}

function sendKey(remoteid, key, cb)
{
    var remote = remotes[remoteid];

    if (!remote) {
        log('Unknown remote "' + remoteid + '"');
        if (cb) cb(false);
        return;
    }

    if (!remote.keys.hasOwnProperty(key)) {
        log('Unknown key "' + key + '"');
        if (cb) cb(false);
        return;
    }

    var cmd = remote.keys[key].replace('1:1', remote.connector);

    sendRawCommand(remote.deviceid, cmd + '\r', cb);
}

function learnKey(remoteid, key)
{
    var remote = remotes[remoteid];

    if (!remote) {
        log('Unknown remote "' + remoteid + '"');
        return;
    }

    devices[remote.deviceid].dev.learn(function (err, res) {

        if (err) {
            log('Learn error: ' + err);
            return;
        }

        saveCode(remoteid, key, res);
    
        conn.emit('IRKeyLearned', { remoteid: remoteid, key: key });
    });
}

function saveCode(remoteid, key, code)
{
    remotes[remoteid].keys[key] = code;

    saveRemotes();
}

function saveRemotes()
{
    conn.emit('setConfig', { itach_remotes: JSON.stringify(remotes) });
}

function saveCustomRemote(r)
{
    r.keys = {};
    r.id = require('node-uuid').v4();

    remotes[r.id] = r;

    saveRemotes();

    conn.emit('customRemoteAdded', r);
}

function updateCustomRemote(r)
{
    if (!remotes.hasOwnProperty(r.id)) {
        return;
    }

    r.keys = remotes[r.id].keys;

    remotes[r.id] = r;

    saveRemotes();

    conn.emit('customRemoteUpdated', r);
}

function deleteCustomRemote(id)
{
    delete remotes[id];

    saveRemotes();

    conn.emit('customRemoteDeleted', id);
}

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

        customremotes.push(r2);
    }

    conn.emit('customRemotes', customremotes);

    if (cb) cb(customremotes);
}
