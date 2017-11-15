"use strict";

var conn;

var logger;

var categories, devices;

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var Cats = function (c, l) {

    conn = c;
    logger = l.child({component: 'Cats'});

    categories = cfg.get('cats_categories', { generic: { name: 'Generic room' } });
    devices = cfg.get('cats_devices', {});

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

    conn.on('catSet', function (command) {
        catSet.apply(command, command.args);
    });

    conn.on('catListDevices', function (command) {
        catListDevices.apply(command, command.args);
    });

    conn.on('catOfDevice', function (command) {
        catOfDevice.apply(command, command.args);
    });

    conn.on('catAddDevices', function (command) {
        catAddDevices.apply(command, command.args);
    });
};

Cats.getCat = function (deviceid) {

    if (!devices[deviceid] || devices[deviceid].length === 0) {
        return null;
    }

    return devices[deviceid][0];
};

Cats.save = function (cb) {
    cfg.setMulti({
        'cats_categories': categories,
        'cats_devices': devices
    }, cb);
};

function catAdd(cat, cb)
{
    var catid = require('uuid/v4')();
    categories[catid] = cat;
    Cats.save();

    logger.debug('Category', catid, 'added');

    if (typeof cb === 'function') {
        cb(catid);
    }
}

function catDelete(catid, cb)
{
    delete categories[catid];

    for (var deviceid in devices) {
        removeCatFromDevice(catid, deviceid);
    }

    Cats.save(cb);

    logger.debug('Category', catid, 'deleted');
}

function catUpdate(catid, cat, cb)
{
    categories[catid] = cat;
    Cats.save(cb);

    logger.debug('Category', catid, 'updated');
}

function getCategories(cb)
{
    var cat_array = hash_to_array(categories);

    if (typeof cb === 'function') {
        cb(cat_array);
    }
}

function catSet(catid, deviceid, cb)
{
    devices[deviceid] = [catid];

    Cats.save(cb);
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

    if (typeof cb === 'function') {
        cb(devs);
    }
}

function catAddDevices(catid, devicelist, cb)
{
    for (var d in devices) {
        removeCatFromDevice(catid, d);
    }

    for (var i = 0; i < devicelist.length; i++) {
        devices[devicelist[i]] = [catid];
    }

    Cats.save(cb);
}

function catOfDevice(deviceid, cb)
{
    var cats = Cats.getCats(deviceid);

    conn.broadcast('catOfDevice', cats);

    if (typeof cb === 'function') {
        cb(cats);
    }
}

function removeCatFromDevice(catid, deviceid)
{
    devices[deviceid] = devices[deviceid].filter(function (c) {
        return c !== catid;
    });
}

module.exports = Cats;
