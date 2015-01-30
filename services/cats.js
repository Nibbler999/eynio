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

    conn.on('catAdd', function (cat) {
        var catid = require('node-uuid').v4();
        categories[catid] = cat;
        Cats.update();
    });

    conn.on('catDelete', function (catid) {

        delete categories[catid];

        for (var deviceid in devices) {
            removeCatFromDevice(catid, deviceid); 
        }

        Cats.update();
    });

    conn.on('catUpdate', function (catid, cat) {
        categories[catid] = cat;
        Cats.update();
    });

    conn.on('catList', function () {
        conn.emit('catList', categories);
    });

    conn.on('catAddDevice', function (catid, deviceid) {

        if (!devices.hasOwnProperty(deviceid)) {
            devices[deviceid] = [];
        }

        devices[deviceid].push(catid);

        Cats.update();
    });

    conn.on('catDeleteDevice', function (catid, deviceid) {
        removeCatFromDevice(catid, devices[deviceid]);
        Cats.update();
    });

    conn.on('catListDevices', function (catid) {

        var devs = [];
    
        for (var deviceid in devices) {
    
            if (devices[deviceid].indexOf(catid) !== -1) {
                devs.push(deviceid);
            }
        }

        conn.emit('catList', devs);  
    });

    conn.on('catOfDevice', function (deviceid) {
        conn.emit('catOfDevice', devices[deviceid] || []);  
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
