"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn;

var devices = {}, bridges = {}, nhome;

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'NHomeSlave'});

    conn.once('accepted', function (cfg) {
    
        if (!cfg.nhome_apikey) {
            return;
        }

        var io = require('socket.io-client');
        
        var serverUrl = 'https://nhome.ba/client?apikey=' + cfg.nhome_apikey;
        
        nhome = io(serverUrl, {'force new connection': true});
        
        log('Connecting...');
    
        nhome.on('connect', function () {

            log('Connected.');

            bridges['nhome:' + cfg.nhome_apikey] = { };

            startListening();
        });

        nhome.on('connect_error', function () {
            log('Failed to connect to NHome.');
        });

        nhome.on('lightState', function(lightstate) {
            conn.emit('lightState', lightstate);
        });
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getLights', function (cb) {
        getLights(cb);    
    });

    conn.on('getLightState', function (id, cb) {
        getLightState(id, cb);
    });

    conn.on('setLightState', function (id, values) {
        setLightState(id, values);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'NHome Slave', id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getLights(cb)
{
    var l = [];

    nhome.emit('getLights', function(lights) {

        lights.forEach(function(light) {
            l.push({
                id: light.id,
                name: light.name,
                categories: Cats.getCats(light.id)
            });
        });

        conn.emit('lights', l);

        if (cb) cb(l);
    });
}

function getLightState(id, cb)
{
    nhome.emit('getLightState', id, cb);
}

function setLightState(id, state)
{
    nhome.emit('setLightState', id, state);
}
