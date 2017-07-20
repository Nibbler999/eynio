"use strict";

var orvibo = new (require('node-orvibo'))();

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
    logger = l.child({component: 'Orvibo'});

    orvibo.on('deviceadded', function (device) {
        setTimeout(function() {
            orvibo.subscribe(device);
        }, 1000);
    });

    orvibo.on('deviceupdated', function (device) {
        devices[device.macAddress] = device;
    });

    orvibo.on('subscribed', function (device) {

        if (!devices.hasOwnProperty(device.macAddress)) {
            log('Discovered device', device.type);
            devices[device.macAddress] = device;
            Namer.add(devices);
        }
    });

    orvibo.once('deviceadded', function() {
        startListening();
    });

    orvibo.once('ready', function () {
        orvibo.discover();
        setInterval(function() { orvibo.discover(); }, 20000);
    });

    orvibo.on('externalstatechanged', function (device, state) {
        conn.broadcast('switchState', { id: device.macAddress, state: { on: state } });
    });

    orvibo.on('error', function (err) {
        logger.error(err);
    });

    try {
        orvibo.listen();
    } catch (e) {
        logger.error(e);
    }
};

function startListening()
{
    log('Ready for commands');

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('switchOn', function (command) {
        switchOn.apply(command, command.args);
    });

    conn.on('switchOff', function (command) {
        switchOff.apply(command, command.args);
    });

    conn.on('getSwitchState', function (command) {
        getSwitchState.apply(command, command.args);
    });

    conn.on('getDevicePowerState', function (command) {
        getDevicePowerState.apply(command, command.args);
    });

    conn.on('setDevicePowerState', function (command) {
        setDevicePowerState.apply(command, command.args);
    });

    conn.on('toggleDevicePowerState', function (command) {
        toggleDevicePowerState.apply(command, command.args);
    });

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
        if (devices[device].type === 'AllOne') {
            r.push({
                id: device,
                name: Namer.getName(device),
                module: 'orvibo'
            });
        }
    }

    conn.broadcast('remotes', r);

    if (typeof cb === 'function') {
        cb(r);
    }
}

function getDevices(cb)
{
    var switches = [];

    for (var device in devices) {
        if (devices[device].type === 'Socket') {
            switches.push({
                id: device,
                name: Namer.getName(device),
                value: devices[device].state,
                type: 'switch',
                module: 'orvibo'
            });
        }
    }

    if (typeof cb === 'function') {
        cb(switches);
    }
}

function switchOn(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    orvibo.setState({device: devices[id], state: true});

    this.log(id, Namer.getName(id), 'switch-on');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function switchOff(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    orvibo.setState({device: devices[id], state: false});

    this.log(id, Namer.getName(id), 'switch-off');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var switchState = { on: devices[id].state };

    if (typeof cb === 'function') {
        cb(switchState);
    }
}

function setDevicePowerState(id, on, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (on) {
        switchOn.call(this, id, cb);
    } else {
        switchOff.call(this, id, cb);
    }
}

function getDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (typeof cb === 'function') {
        cb(devices[id].state);
    }
}

function toggleDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var self = this;

    getDevicePowerState(id, function (state) {
        setDevicePowerState.call(self, id, !state, cb);
    });
}

function sendRemoteKey(remote, code, cb)
{
    if (!devices.hasOwnProperty(remote.deviceid)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    orvibo.emitIR({device: devices[remote.deviceid], ir: code});

    if (typeof cb === 'function') {
        cb(true);
    }
}

function learnRemoteKey(deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    orvibo.enterLearningMode(devices[deviceid]);

    orvibo.on('ircode', function (device, code) {

        if (!code) {
            return;
        }

        if (typeof cb === 'function') {
            cb(code);
        }

        orvibo.removeAllListeners('ircode');
    });
}
