"use strict";

var Cats = require('../services/cats.js');

var conn;

var bridges = {}, nhome;

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'NHomeSlave'});

    conn.once('accepted', function (cfg) {

        if (!cfg.nhome_apikey) {
            return;
        }

        var io = require('socket.io-client');

        var serverUrl = 'https://nhome.ba/client?apikey=' + cfg.nhome_apikey;

        nhome = io(serverUrl, {'force new connection': true});

        log('Connecting...');

        nhome.on('connect', function () {

            log('Connected.');

            bridges['nhome:' + cfg.nhome_apikey] = { };

            startListening();
        });

        nhome.on('connect_error', function () {
            log('Failed to connect to NHome.');
        });
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getLights', function (cb) {
        getLights(cb);
    });

    conn.on('getSwitches', function (cb) {
        getSwitches(cb);
    });

    conn.on('getSensors', function (cb) {
        getSensors(cb);
    });

    conn.on('getRemotes', function (cb) {
        getRemotes(cb);
    });

    conn.on('getCustomRemotes', function (cb) {
        getCustomRemotes(cb);
    });

    conn.on('getShutters', function (cb) {
        getShutters(cb);
    });

    var events = [
        'getLightState', 'setLightState', 'setLightColor', 'setLightWhite', 'setLightLevel',
        'switchOn', 'switchOff', 'getSwitchState',
        'getSensorValue',
        'sendRemoteCommand', 'sendKey', 'learnKey', 'saveCustomRemote', 'updateCustomRemote', 'deleteCustomRemote',
        'getShutterValue', 'setShutterValue', 'openShutter', 'closeShutter'
    ];

    events.forEach(function(eventName) {
        conn.on(eventName, function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(eventName);
            nhome.emit.apply(nhome, args);
        });
    });

    var broadcasts = [
        'lightState', 'switchState', 'sensorValue', 'shutterValue',
        'IRKeyLearned', 'customRemoteAdded', 'customRemoteUpdated', 'customRemoteDeleted'
    ];

    broadcasts.forEach(function(eventName) {
        nhome.on(eventName, function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(eventName);
            conn.emit.apply(conn, args);
        });
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'NHome Slave', id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getLights(cb)
{
    nhome.emit('getLights', function(devices) {

        if (devices) devices.forEach(function(device) {
            device.categories = Cats.getCats(device.id);
        });

        conn.emit('lights', devices);

        if (cb) cb(devices);
    });
}

function getSwitches(cb)
{
    nhome.emit('getSwitches', function(devices) {

        if (devices) devices.forEach(function(device) {
            device.categories = Cats.getCats(device.id);
        });

        conn.emit('switches', devices);

        if (cb) cb(devices);
    });
}

function getSensors(cb)
{
    nhome.emit('getSensors', function(devices) {

        if (devices) devices.forEach(function(device) {
            device.categories = Cats.getCats(device.id);
        });

        conn.emit('sensors', devices);

        if (cb) cb(devices);
    });
}

function getRemotes(cb)
{
    nhome.emit('getRemotes', function(devices) {

        if (devices) devices.forEach(function(device) {
            device.categories = Cats.getCats(device.id);
        });

        conn.emit('remotes', devices);

        if (cb) cb(devices);
    });
}

function getCustomRemotes(cb)
{
    nhome.emit('getCustomRemotes', function(devices) {

        if (devices) devices.forEach(function(device) {
            device.categories = Cats.getCats(device.id);
        });

        conn.emit('customRemotes', devices);

        if (cb) cb(devices);
    });
}

function getShutters(cb)
{
    nhome.emit('getShutters', function(devices) {

        if (devices) devices.forEach(function(device) {
            device.categories = Cats.getCats(device.id);
        });

        conn.emit('shutters', devices);

        if (cb) cb(devices);
    });
}
