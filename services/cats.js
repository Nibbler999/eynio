"use strict";

var Cats = {}, categories = {}, devices = {}, conn;

var logger;

Cats.listen = function(c, l) {

    conn = c;
    logger = l.child({component: 'Cats'});

    conn.once('accepted', function (cfg) {

        if (cfg.cats_categories) {
            categories = JSON.parse(cfg.cats_categories);
        }

        if (cfg.cats_devices) {
            devices = JSON.parse(cfg.cats_devices);
        }
    });

    conn.on('catAdd', function (cat, cb) {
        var catid = require('node-uuid').v4();
        categories[catid] = cat;
        Cats.update();

        if (cb) cb(catid);
    });

    conn.on('catDelete', function (catid, cb) {

        delete categories[catid];

        for (var deviceid in devices) {
            removeCatFromDevice(catid, deviceid); 
        }

        Cats.update();

        if (cb) cb();
    });

    conn.on('catUpdate', function (catid, cat, cb) {
        categories[catid] = cat;
        Cats.update();

         if (cb) cb();
    });

    conn.on('catList', function (cb) {
        conn.emit('catList', categories);
        if (cb) cb(categories);
    });

    conn.on('catAddDevice', function (catid, deviceid, cb) {

        if (!devices.hasOwnProperty(deviceid)) {
            devices[deviceid] = [];
        }

        devices[deviceid].push(catid);

        Cats.update();

        if (cb) cb();
    });

    conn.on('catDeleteDevice', function (catid, deviceid, cb) {
        removeCatFromDevice(catid, deviceid);
        Cats.update();

        if (cb) cb();
    });

    conn.on('catListDevices', function (catid, cb) {

        var devs = [];
    
        for (var deviceid in devices) {
    
            if (devices[deviceid].indexOf(catid) !== -1) {
                devs.push(deviceid);
            }
        }

        conn.emit('catList', devs);  
        
        if (cb) cb(devs);
    });

    conn.on('catOfDevice', function (deviceid, cb) {
        conn.emit('catOfDevice', devices[deviceid] || []);
        if (cb) cb(devices[deviceid] || []);
    });
};

Cats.getCats = function(deviceid) {
    return devices[deviceid] || [];
};

Cats.save = function() {
    conn.emit('setConfig', {
        cats_categories: JSON.stringify(categories),
        cats_devices: JSON.stringify(devices)
    });
};

Cats.update = function() {

    for (var deviceid in devices) {
        if (devices[deviceid].length === 0) {
            delete devices[deviceid];
        }
    }

    Cats.save();
};

function removeCatFromDevice(catid, deviceid)
{
    devices[deviceid] = devices[deviceid].filter(function (c) {
        return c !== catid;
    });
}

module.exports = Cats;
