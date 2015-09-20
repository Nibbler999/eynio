"use strict";

var Itach = require('simple-itach');

var Namer = require('../services/namer.js');

var conn;

var devices = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'iTach'});

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
};

function startListening()
{
    log('Ready for commands');

    conn.on('getRemotes', function (command) {
        getRemotes.apply(command, command.args);
    });

    conn.on('sendRemoteKey', function () {
        sendRemoteKey.apply(null, arguments);
    });

    conn.on('learnRemoteKey', function () {
        learnRemoteKey.apply(null, arguments);
    });
}

function getRemotes(cb)
{
    var r = [];

    for (var device in devices) {
        r.push({
            id: device,
            name: Namer.getName(device),
            module: 'itach'
        });
    }

    conn.broadcast('remotes', r);

    if (cb) cb(r);
}

function sendRemoteKey(remote, code, cb)
{
    if (!devices.hasOwnProperty(remote.deviceid)) {
        if (cb) cb();
        return;
    }

    var cmd = code.replace('1:1', remote.connector) + '\r';

    devices[remote.deviceid].dev.send(cmd, function (err) {
        if (err) {
            log(err);
            if (cb) cb(false);
            return;
        }
        if (cb) cb(true);
    });
}

function learnRemoteKey(deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        if (cb) cb();
        return;
    }

    devices[deviceid].dev.learn(function (err, res) {

        if (err) {
            log('Learn error: ' + err);
            if (cb) cb(false);
            return;
        }

        cb(res);
    });
}

