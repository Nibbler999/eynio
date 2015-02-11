"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn;

var devices = {}, bridges = {}, nhome;

var logger;

var apikey = 'xxx';

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'NHomeSlave'});

    conn.once('accepted', function (cfg) {
    
        var io = require('socket.io-client');
        
        var serverUrl = 'https://nhome.ba/client?apikey=' + apikey;
        
        nhome = io(serverUrl, {'force new connection': true});
        
        log('Connecting...');
    
        nhome.on('connect', function () {

            log('Connected.');

            bridges['nhome:' + apikey] = { };

            startListening();
        });

        nhome.on('connect_error', function () {
            log('Failed to connect to NHome.');
        });

        nhome.on('lightState', function(lightstate) {
            lightstate.id = 'xxx' + lightstate.id;
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

            var id = 'xxx' + light.id;

            l.push({
                id: id,
                name: light.name,
                categories: Cats.getCats(id)
            });
        });

        conn.emit('lights', l);

        if (cb) cb(l);
    });
}

function getLightState(id, cb)
{
    var remoteid = id.replace('xxx', '');

    nhome.emit('getLightState', remoteid, function(state) {

        conn.emit('lightState', { id: remoteid, state: state });

        if (cb) cb(state);
    });
}

function setLightState(id, state)
{
    var remoteid = id.replace('xxx', '');

    nhome.emit('setLightState', remoteid, state);
}
