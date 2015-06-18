"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');
var cfg = require('../configuration.js');

var conn;

var sensors = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'NHomeBridge'});

    var server = require('dgram').createSocket("udp4");

    server.bind(2390, function () {
        server.addMembership('224.0.0.1');
    });
    
    server.on('message', function (packet, rinfo) {

        var info = JSON.parse(packet.toString());

        if (!sensors.hasOwnProperty(info.ID + '-' + 'temperature')) {

            log('Discovered device');

            var WebSocket = require('ws');

            var ws = new WebSocket('ws://' + rinfo.address + ':' + info.Port);

            ws.on('open', function open() {

                ws.send('sensor');

                ws.once('message', function (data) {

                    var sensorinfo = JSON.parse(data);

                    for (var s in sensorinfo) {
                        sensors[info.ID + '-' + s] = {
                            name: 'NHomeBridge ' + s,
                            value: sensorinfo[s],
                            subtype: s
                        };
                    }

                    Namer.add(sensors);
                });
            });
        }
    });

    server.once('message', function (packet, rinfo) {
        startListening();
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });
}

function getDevices(cb)
{
    var blacklist = cfg.get('blacklist_devices', []);

    var all = [];

    for (var sensor in sensors) {
        all.push({
            id: sensor,
            name: Namer.getName(sensor),
            value: sensors[sensor].value,
            type: 'sensor',
            subtype: sensors[sensor].subtype,
            categories: Cats.getCats(sensor),
            blacklisted: blacklist.indexOf(sensor) !== -1
        });
    }

    if (cb) cb(all);
}

