
/*
var Namer = require('../services/namer.js');
Namer.add(devices);
name: Namer.getName(device)
*/

var realnames = {}, customnames = {}, conn;

var Namer = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

Namer.listen = function(c, l) {

    conn = c;
    logger = l.child({component: 'MJPEG'});

    conn.once('accepted', function (cfg) {
        if (cfg.namer_customnames) {
            customnames = JSON.parse(cfg.namer_customnames);
        }
    });

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
}

Namer.save = function() {
    conn.emit('setConfig', { namer_customnames: JSON.stringify(customnames) });
}

Namer.add = function(devices) {

    for (var id in devices) {
        realnames[id] = devices[id].name;
    };
}

Namer.getName = function(id) {
    return customnames[id] || realnames[id] || 'Unknown';
}

Namer.deviceRenamed = function(id) {
    Namer.save();
    conn.emit('deviceRenamed', id, Namer.getName(id));
}

Namer.bridgeRenamed = function(id) {
    Namer.save();
    conn.emit('bridgeRenamed', id, Namer.getName(id));
}

module.exports = Namer;
