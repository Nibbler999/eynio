"use strict";

var tcpp = require('tcp-ping');

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

        if (!available) {
            return cb();
        }

        console.log('.');

        setTimeout(monitor, 20 * 1000, host, port, cb);
    });
};

module.exports = common;

