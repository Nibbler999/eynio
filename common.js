"use strict";

var tcpp = require('tcp-ping');

var Cats = require('./services/cats.js');
var Props = require('./services/device-properties.js');

var cfg = require('./configuration.js');

var common = {};

/*

when we detect a device/bridge, call monitor on it
provide a callback which will remove the bridge/device
will then set shorter discovery interval
call discovery

after a successful discovery set longer interval

Do a full discovery for local devices every 2 minutes

only applies to devices that need to be actively discovered

monitor('google.com', 80, function() {
    console.log('down');
});

*/

common.monitor = function(host, port, cb) {

    tcpp.probe(host, port, function (err, available) {

        if (err || !available) {
            return cb();
        }

        console.log('.');

        setTimeout(common.monitor, 20 * 1000, host, port, cb);
    });
};

common.addDeviceProperties = function (devicelist) {

    var blacklist = cfg.get('blacklist_devices', []);
    var activations = cfg.get('device_activations', {});

    var id = '', properties = {};

    for (var d = 0; d < devicelist.length; d++) {
        id = devicelist[d].id;
        devicelist[d].categories = Cats.getCats(id);
        devicelist[d].blacklisted = blacklist.indexOf(id) !== -1;

        properties = Props.get(id);

        for (var p in properties) {
            devicelist[d][p] = properties[p];
        }

        if (activations[id]) {
            devicelist[d].last_activated = activations[id];
        } else {
            devicelist[d].last_activated = null;
        }
    }
};

module.exports = common;

