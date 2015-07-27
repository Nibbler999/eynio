"use strict";

var conn;

var logger;

var categories, devices;

var Cats = {};

Cats.listen = function (c, l) {

    conn = c;
    logger = l.child({component: 'Cats'});

    var cfg = require('../configuration.js');

    categories = cfg.get('cats_categories', {});
    devices = cfg.get('cats_devices', {});

    if (!categories.dashboard) {

        categories.dashboard = {
            name: 'Dashboard'
        };

        Cats.save();
    }

    conn.on('catAdd', function (command) {
        catAdd.apply(command, command.args);
    });

    conn.on('catDelete', function (command) {
        catDelete.apply(command, command.args);
    });

    conn.on('catUpdate', function (command) {
        catUpdate.apply(command, command.args);
    });

    conn.on('catList', function (command) {
        catList.apply(command, command.args);
    });

    conn.on('catAddDevice', function (command) {
        catAddDevice.apply(command, command.args);
    });

    conn.on('catDeleteDevice', function (command) {
        catDeleteDevice.apply(command, command.args);
    });

    conn.on('catListDevices', function (command) {
        catListDevices.apply(command, command.args);
    });

    conn.on('catOfDevice', function (command) {
        catOfDevice.apply(command, command.args);
    });
};

Cats.getCats = function(deviceid) {
    return devices[deviceid] || [];
};

Cats.save = function() {

    var cfg = require('../configuration.js');

    cfg.set('cats_categories', categories);
    cfg.set('cats_devices', devices);
};

Cats.update = function() {

    for (var deviceid in devices) {
        if (devices[deviceid].length === 0) {
            delete devices[deviceid];
        }
    }

    Cats.save();
};

function catAdd(cat, cb)
{
    var catid = require('node-uuid').v4();
    categories[catid] = cat;
    Cats.update();

    if (cb) cb(catid);
}

function catDelete(catid, cb)
{
    if (catid === 'dashboard') {
        if (cb) cb(false);
        return false;
    }

    delete categories[catid];

    for (var deviceid in devices) {
        removeCatFromDevice(catid, deviceid);
    }

    Cats.update();

    if (cb) cb(true);
}

function catUpdate(catid, cat, cb)
{
    categories[catid] = cat;
    Cats.update();

    if (cb) cb();
}

function catList(cb)
{
    conn.broadcast('catList', categories);

    if (cb) cb(categories);
}

function catAddDevice(catid, deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        devices[deviceid] = [];
    }

    devices[deviceid].push(catid);

    Cats.update();

    if (cb) cb();
}

function catDeleteDevice(catid, deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        devices[deviceid] = [];
    }

    removeCatFromDevice(catid, deviceid);

    Cats.update();

    if (cb) cb();
}

function catListDevices(catid, cb)
{
    var devs = [];

    for (var deviceid in devices) {

        if (devices[deviceid].indexOf(catid) !== -1) {
            devs.push(deviceid);
        }
    }

    conn.broadcast('catList', devs);

    if (cb) cb(devs);
}

function catOfDevice(deviceid, cb)
{
    conn.broadcast('catOfDevice', devices[deviceid] || []);

    if (cb) cb(devices[deviceid] || []);
}

function removeCatFromDevice(catid, deviceid)
{
    devices[deviceid] = devices[deviceid].filter(function (c) {
        return c !== catid;
    });
}

module.exports = Cats;
