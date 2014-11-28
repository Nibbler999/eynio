var Itach = require('simple-itach');

var conn;

var devices = {};

var remotes = {};

function log(msg)
{
    console.log('[iTach]', msg);
}

module.exports = function(c) {

    conn = c;

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
            }
        });

        d.once('device', function(device) {
            startListening();
        });
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function() {
        sendBridgeInfo();
    });

    conn.on('getRemotes', function () {
        getRemotes();    
    });
    
    conn.on('sendRemoteCommand', function (id, cmd) {
        sendRawCommand(id, cmd);
    });

    conn.on('sendKey', function (remoteid, key) {
        sendKey(remoteid, key);
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

    conn.on('getCustomRemotes', function () {
        getCustomRemotes();
    });
}

function sendBridgeInfo()
{
    for (var device in devices) {
        conn.emit('bridgeInfo', { name: devices[device].name, id: device });
    }
}

function getRemotes()
{
    var remotes = [];

    for (var device in devices) {
        remotes.push({id: device, name: devices[device].name});
    }

    conn.emit('remotes', remotes);
}

function sendRawCommand(id, cmd)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.send(cmd, function (err, res) {
        if (err) {
            log(err);
            return;
          }
    });
}

function sendKey(remoteid, key)
{
    var remote = remotes[remoteid];

    if (!remote.keys.hasOwnProperty(key)) {
        log('Unknown key "' + key + '"');
        return;
    }

    cmd = remote.keys[key].replace('1:1', remote.connector);

    sendRawCommand(remote.deviceid, cmd + '\r');
}

function learnKey(remoteid, key)
{
    var id = remotes[remoteid].deviceid;

    devices[id].dev.learn(function (err, res) {

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

function getCustomRemotes()
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
}
