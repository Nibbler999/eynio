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

    conn.on('setSubNHome', function (command) {
        setSubNHome.apply(command, command.args);
    });

    var cfg = require('../configuration.js');
    var apikey = cfg.get('nhome_apikey', false);

    if (!apikey) {
        return;
    }

    var io = require('socket.io-client');

    var serverUrl = 'https://nhome.ba/client?apikey=' + apikey;

    nhome = io(serverUrl, {'force new connection': true});

    log('Connecting...');

    nhome.once('connect', function () {

        log('Connected.');

        bridges['nhome:' + apikey] = { };

        startListening();
    });

    nhome.on('connect_error', function () {
        log('Failed to connect to NHome.');
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function (command) {
        getBridges.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('getRemotes', function (command) {
        getRemotes.apply(command, command.args);
    });

    conn.on('getCustomRemotes', function (command) {
        getCustomRemotes.apply(command, command.args);
    });

    var events = [
        'getLightState', 'setLightState', 'setLightColor', 'setLightWhite',
        'switchOn', 'switchOff', 'getSwitchState',
        'getSensorValue',
        'sendRemoteCommand', 'sendKey', 'learnKey', 'saveCustomRemote', 'updateCustomRemote', 'deleteCustomRemote',
        'getShutterValue', 'setShutterValue', 'openShutter', 'closeShutter',
        'setDevicePowerState'
    ];

    events.forEach(function(eventName) {
        conn.on(eventName, function (command) {
            var args = Array.prototype.slice.call(command.args);
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
            conn.broadcast.apply(conn, args);
        });
    });
}

function setSubNHome(server, cb)
{
    var cfg = require('../configuration.js');

    cfg.set('nhome_apikey', server.apikey);

    if (cb) cb();
}

function getBridges(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'NHome Slave', id: bridge });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getDevices(cb)
{
    nhome.emit('getDevices', function(devices) {

        if (devices) {
            devices.forEach(function(device) {
                device.categories = Cats.getCats(device.id);
            });
        }

        if (cb) cb(devices);
    });
}

function getRemotes(cb)
{
    nhome.emit('getRemotes', function(devices) {

        if (devices) {
            devices.forEach(function(device) {
                device.categories = Cats.getCats(device.id);
            });
        }

        conn.broadcast('remotes', devices);

        if (cb) cb(devices);
    });
}

function getCustomRemotes(cb)
{
    nhome.emit('getCustomRemotes', function(devices) {

        if (devices) {
            devices.forEach(function(device) {
                device.categories = Cats.getCats(device.id);
            });
        }

        conn.broadcast('customRemotes', devices);

        if (cb) cb(devices);
    });
}

