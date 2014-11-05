
/*
var Namer = require('../services/namer.js');
Namer.add(devices);
name: Namer.getName(device)
*/

var realnames = {}, customnames = {}, conn;

var Namer = {};

Namer.listen = function(c) {

    conn = c;

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
}

Namer.save = function() {
    conn.emit('setConfig', { namer_customnames: JSON.stringify(customnames) });
}

Namer.add = function(devices) {

    for (id in devices) {
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

module.exports = Namer;
