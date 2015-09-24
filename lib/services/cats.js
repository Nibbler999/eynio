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

    conn.on('getCategories', function (command) {
        getCategories.apply(command, command.args);
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

Cats.getCats = function (deviceid) {

    if (!devices[deviceid] || devices[deviceid].length === 0) {
        devices[deviceid] = ['dashboard'];
        Cats.save();
    }

    return devices[deviceid];
};

Cats.save = function() {

    var cfg = require('../configuration.js');

    cfg.set('cats_categories', categories);
    cfg.set('cats_devices', devices);
};

function catAdd(cat, cb)
{
    var catid = require('node-uuid').v4();
    categories[catid] = cat;
    Cats.save();

    logger.debug('Category', catid, 'added');

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

    Cats.save();

    logger.debug('Category', catid, 'deleted');

    if (cb) cb(true);
}

function catUpdate(catid, cat, cb)
{
    categories[catid] = cat;
    Cats.save();

    logger.debug('Category', catid, 'updated');

    if (cb) cb();
}

function getCategories(cb)
{
    var cat_array = hash_to_array(categories);

    cat_array = cat_array.sort(function(a) {
        return a.id === 'dashboard' ? -1 : 1;
    });

    if (cb) cb(cat_array);
}

function catAddDevice(catid, deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        devices[deviceid] = [];
    }

    if (devices[deviceid].indexOf(catid) === -1) {
        devices[deviceid].push(catid);
        Cats.save();
    }    

    if (cb) cb();
}

function catDeleteDevice(catid, deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        devices[deviceid] = [];
    }

    removeCatFromDevice(catid, deviceid);

    Cats.save();

    if (cb) cb();
}

function catListDevices(catid, cb)
{
    var devs = [];

    for (var deviceid in devices) {

        if (Cats.getCats(deviceid).indexOf(catid) !== -1) {
            devs.push(deviceid);
        }
    }

    conn.broadcast('catList', devs);

    if (cb) cb(devs);
}

function catOfDevice(deviceid, cb)
{
    var cats = Cats.getCats(deviceid);

    conn.broadcast('catOfDevice', cats);

    if (cb) cb(cats);
}

function removeCatFromDevice(catid, deviceid)
{
    devices[deviceid] = devices[deviceid].filter(function (c) {
        return c !== catid;
    });
}

function hash_to_array(hash)
{
    var array = [], object;

    for (var key in hash) {

        object = {
            id: key
        };

        for (var key2 in hash[key]) {
            object[key2] = hash[key][key2];
        }

        array.push(object);
    }

    return array;
}

module.exports = Cats;
