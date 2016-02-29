"use strict";

var Cats = require('../services/cats.js');
var cfg = require('../configuration.js');

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

    var apikey = cfg.get('nhome_apikey', false);

    if (!apikey) {
        return;
    }

    addFromKey(apikey);
};

function addFromKey(apikey)
{
    var serverUrl;

    if (/^[a-f0-9]{32}$/.test(apikey)) {

        conn.send('checkApiKey', apikey, function (server) {
            serverUrl = 'https://nhome.ba/client?apikey=' + apikey + '&server=' + server;
            addConnection(apikey, serverUrl);
        });

    } else {
        serverUrl = 'http://' + apikey + ':8008/client';
        addConnection(apikey, serverUrl);
    }
}

function addConnection(id, serverUrl)
{
    var io = require('socket.io-client');

    nhome = io(serverUrl, {'force new connection': true});

    log('Connecting...');

    nhome.once('connect', function () {

        log('Connected.');

        bridges['nhome:' + id] = { };

        startListening();
    });

    nhome.on('connect_error', function () {
        log('Failed to connect to NHome.');
    });
}

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
        'getShutterValue', 'setShutterValue', 'openShutter', 'closeShutter', 'stopShutter', 'toggleShutter',
        'getDevicePowerState', 'setDevicePowerState', 'toggleDevicePowerState',
        'getCameras', 'getCamera', 'getCachedThumbnail', 'getLiveThumbnail', 'startStreaming', 'stopStreaming',
        'getThermostatValue', 'setThermostatValue'
    ];

    events.forEach(function(eventName) {
        conn.on(eventName, function (command) {
            var args = Array.prototype.slice.call(command.args);
            args.unshift(eventName);
            nhome.emit.apply(nhome, args);
        });
    });

    var broadcasts = [
        'lightState', 'switchState', 'sensorValue', 'shutterValue', 'thermostatValue',
        'IRKeyLearned', 'customRemoteAdded', 'customRemoteUpdated', 'customRemoteDeleted',
        'cameraFrame', 'cameraAdded', 'cameraUpdated', 'cameraDeleted'
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
    cfg.set('nhome_apikey', server.apikey);

    addFromKey(server.apikey);

    if (typeof cb === 'function') {
        cb();
    }
}

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: 'NHome Slave',
            module: 'nhome',
            id: bridge,
            ip: null,
            mac: null,
            blacklisted: blacklist.indexOf(bridge) !== -1
        });
    }

    if (typeof cb === 'function') {
        cb(bridgeInfo);
    }
}

function getDevices(cb)
{
    var blacklist = cfg.get('blacklist_devices', []);

    nhome.emit('getDevices', function(devices) {

        if (devices) {
            devices.forEach(function(device) {
                device.categories = Cats.getCats(device.id); // Deprecated
                device.category = Cats.getCat(device.id);
                device.blacklisted = device.blacklisted || blacklist.indexOf(device.id) !== -1;
            });
        }

        if (typeof cb === 'function') {
            cb(devices);
        }
    });
}

function getRemotes(cb)
{
    nhome.emit('getRemotes', function(devices) {

        if (devices) {
            devices.forEach(function(device) {
                device.categories = Cats.getCats(device.id); // Deprecated
                device.category = Cats.getCat(device.id);
            });
        }

        conn.broadcast('remotes', devices);

        if (typeof cb === 'function') {
            cb(devices);
        }
    });
}

function getCustomRemotes(cb)
{
    nhome.emit('getCustomRemotes', function(devices) {

        if (devices) {
            devices.forEach(function(device) {
                device.categories = Cats.getCats(device.id); // Deprecated
                device.category = Cats.getCat(device.id);
            });
        }

        conn.broadcast('customRemotes', devices);

        if (typeof cb === 'function') {
            cb(devices);
        }
    });
}

