"use strict";

var api;

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {}, bridges = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Nest'});

    conn.once('accepted', function (cfg) {

        conn.emit('getOAuth2Token', 'nest', function(token) {

            if (token.access_token) {

                var Firebase = require('firebase');
                var dataRef = new Firebase('wss://developer-api.nest.com');

                dataRef.authWithCustomToken(token.access_token, function(error, authData) {

                    if (error) {
                        console.error("Login Failed!", error);
                    } else {

                        dataRef.on('value', function (snapshot) {
                            var data = snapshot.val();
                            console.log('nest', data);
                        });

                        startListening();
                    }
                });
            }
        });
    });
};

function startListening()
{
    logger.info('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('getSensors', function (cb) {
        getSensors(cb);
    });

    conn.on('getSensorValue', function (id, cb) {
        getSensorValue(id, cb);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'nest', id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getSensors(cb)
{

}

function getSensorValue(id, cb)
{

}
