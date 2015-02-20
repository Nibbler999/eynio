"use strict";

var lg = require('lg-tv-api');

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'LG'});

    lg.discovery(function(found) {

        for (var f in found) {

            lg.startPairing(found[f].uuid, '965887');

            log('Found a TV');

            devices[found[f].uuid] = {
                name: found[f].friendlyName
            };

            startListening();
        }

        Namer.add(devices);
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('setVolumeUp', function (id) {
        setVolumeUp(id);
    });

    conn.on('setVolumeDown', function (id) {
        setVolumeDown(id);
    });

    conn.on('setChannelUp', function (id) {
        setChannelUp(id);
    });

    conn.on('setChannelDown', function (id) {
        setChannelDown(id);
    });

    conn.on('getMultiMedia', function (cb) {
        getMultiMedia(cb);
    });
}

function getMultiMedia(cb)
{
    var multimedia = [];

    for (var device in devices) {
        multimedia.push({
            id: device,
            name: Namer.getName(device),
            categories: Cats.getCats(device)
        });
    }

    conn.emit('multimedia', multimedia);

    if (cb) cb(multimedia);
}

function setVolumeUp(id)
{
    var cmd = '24';

    sendCommand(id, cmd);
}

function setVolumeDown(id)
{
    var cmd = '25';

    sendCommand(id, cmd);
}

function setChannelUp(id)
{
    var cmd = '27';

    sendCommand(id, cmd);
}

function setChannelDown(id)
{
    var cmd = '28';

    sendCommand(id, cmd);
}

function sendCommand(id, cmd)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    lg.sendCmd(id, cmd, function(err, response) {
        if (err) {
            log(err);
            log(response);
        }
    });
}
