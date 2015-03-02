"use strict";

/*
var Namer = require('../services/namer.js');
Namer.add(devices);
name: Namer.getName(device)
*/

var realnames = {}, customnames, conn;

var Namer = {};

var logger;

Namer.listen = function(c, l) {

    conn = c;
    logger = l.child({component: 'Namer'});

    var cfg = require('../configuration.js');
    customnames = cfg.get('namer_customnames', {});

    conn.on('setDeviceName', function (id, name) {
        customnames[id] = name;
        Namer.deviceRenamed(id);
    });

    conn.on('resetDeviceName', function (id) {
        delete customnames[id];
        Namer.deviceRenamed(id);
    });

    conn.on('setBridgeName', function (id, name) {
        customnames[id] = name;
        Namer.bridgeRenamed(id);
    });

    conn.on('resetBridgeName', function (id) {
        delete customnames[id];
        Namer.bridgeRenamed(id);
    });
};

Namer.save = function() {
    var cfg = require('../configuration.js');
    cfg.set('namer_customnames', customnames);
};

Namer.add = function(devices) {

    for (var id in devices) {
        realnames[id] = devices[id].name;
    }
};

Namer.getName = function(id) {
    return customnames[id] || realnames[id] || 'Unknown';
};

Namer.deviceRenamed = function(id) {
    Namer.save();
    conn.broadcast('deviceRenamed', id, Namer.getName(id));
};

Namer.bridgeRenamed = function(id) {
    Namer.save();
    conn.broadcast('bridgeRenamed', id, Namer.getName(id));
};

module.exports = Namer;
