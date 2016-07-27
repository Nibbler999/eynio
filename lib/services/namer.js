"use strict";

/*
var Namer = require('../services/namer.js');
Namer.add(devices);
name: Namer.getName(device)
*/

var realnames = {}, customnames, conn;

var logger;

var cfg = require('../configuration.js');

var Namer = function (c, l) {

    conn = c;
    logger = l.child({component: 'Namer'});

    customnames = cfg.get('namer_customnames', {});

    conn.on('setDeviceName', function (command) {
        setDeviceName.apply(command, command.args);
    });

    conn.on('resetDeviceName', function (command) {
        resetDeviceName.apply(command, command.args);
    });

    conn.on('setBridgeName', function (command) {
        setBridgeName.apply(command, command.args);
    });

    conn.on('resetBridgeName', function (command) {
        resetBridgeName.apply(command, command.args);
    });
};

function setDeviceName(id, name, cb)
{
    customnames[id] = name;
    Namer.deviceRenamed(id, cb);

    logger.debug('Device', id, 'renamed to', name);
}

function resetDeviceName(id, cb)
{
    delete customnames[id];
    Namer.deviceRenamed(id, cb);
}

function setBridgeName(id, name, cb)
{
    customnames[id] = name;
    Namer.bridgeRenamed(id, cb);

    logger.debug('Bridge', id, 'renamed to', name);
}

function resetBridgeName(id, cb)
{
    delete customnames[id];
    Namer.bridgeRenamed(id, cb);
}

Namer.save = function () {
    cfg.set('namer_customnames', customnames);
};

Namer.add = function (devices) {

    for (var id in devices) {
        realnames[id] = devices[id].name;
    }
};

Namer.getName = function (id) {
    return customnames[id] || realnames[id] || 'Unknown';
};

Namer.deviceRenamed = function (id, cb) {
    Namer.save();
    conn.broadcast('deviceRenamed', id, Namer.getName(id));
    if (typeof cb === 'function') {
        cb(Namer.getName(id));
    }
};

Namer.bridgeRenamed = function (id, cb) {
    Namer.save();
    conn.broadcast('bridgeRenamed', id, Namer.getName(id));
    if (typeof cb === 'function') {
        cb(Namer.getName(id));
    }
};

module.exports = Namer;
