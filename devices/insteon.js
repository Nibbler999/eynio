"use strict";

var Insteon = require('home-controller').Insteon;

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn;

var lights = {}, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Insteon'});

    conn.once('accepted', function (cfg) {
    
        var html = '';

        require('http').get("http://connect.insteon.com/getinfo.asp", function(res) {

            res.on('data', function(d) {
                html += d.toString();
            });

            res.on('end', function() {

                var regex = /<a href="http:..([0-9.]+):25105">/;

                var matches = regex.exec(html);

                if (!matches) {
                    return;
                }

                var host = matches[1];

                log('Hub found');

                var insteon = new Insteon();

                bridges['insteon:' + host] = insteon;

                insteon.on('error', function(err) {
                    log(err);
                });

                insteon.connect(host, function() {
        
                    log('Connected');
           
                    insteon.links(function(error, info) {
                        
                        info.forEach(function(device) {
                            insteon.info(device.id, function(error, info) {
                                if (info.isLighting) {
                                    lights[device.id] = insteon.light(device.id);
                                }
                            });
                        });
                        
                        Namer.add(lights);

                        startListening();
                    }); 
                });

            });

        }).on('error', function(e) {
            console.log("Got error: " + e.message);
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
    
    conn.on('setLightState', function (id, values) {
        setLightState(id, values);
    });

    conn.on('setLightLevel', function (id, level) {
        setLightLevel(id, level);
    });

    conn.on('getLightState', function (id, cb) {
        getLightState(id, cb);
    });
}

function sendBridgeInfo(cb)
{
    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({ name: 'Insteon', id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getLights(cb)
{
    var l = [];

    for (var device in lights) {
        l.push({
            id: device,
            name: Namer.getName(device),
            categories: Cats.getCats(device)
        });
    }

    conn.emit('lights', l);

    if (cb) cb(l);
}

// deprecated
function setLightState(id, values)
{
    if (!lights.hasOwnProperty(id)) {
        return;
    }

    var light = lights[id];

    if (values.hasOwnProperty('on')) {

        if (values.on) {
            light.turnOnFast(function(err) {
                if (err) {
                    log('light.turnOnFast: ' + err);
                    return;
                }
                getLightState(id);
            });
        } else {
            light.turnOffFast(function(err) {
                if (err) {
                    log('light.turnOffFast: ' + err);
                    return;
                }
                getLightState(id);
            });
        }
    }

    if (values.hasOwnProperty('bri')) {

        light.level(parseInt(values.bri, 10), function(err) {
            if (err) {
                log('light.level: ' + err);
                return;
            }
            getLightState(id);
        });
    }
}

function setLightLevel(id, level)
{
    if (!lights.hasOwnProperty(id)) {
        return;
    }

    var light = lights[id];

    if (level > 0) {
        light.turnOn(level, function(err) {
            if (err) {
                log('light.turnOn: ' + err);
                return;
            }
            getLightState(id);
        });
    } else {
        light.turnOffFast(function(err) {
            if (err) {
                log('light.turnOff: ' + err);
                return;
            }
            getLightState(id);
        });
    }
}

function getLightState(id, cb)
{
    if (!lights.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var light = lights[id];

    light.level(function(err, level) {
        var on = level > 0;
        var lightState = { on: on, level: level };
        conn.emit('lightState', { id: id, state: lightState});
        if (cb) cb(lightState);
    });  
}
