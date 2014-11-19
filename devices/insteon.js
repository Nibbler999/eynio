var Insteon = require('home-controller').Insteon;

var Namer = require('../services/namer.js');

var api, conn;

var lights = {}, bridges = {};

function log(msg)
{
    console.log('[Insteon] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        var html = '';

        require('http').get("http://connect.insteon.com/getinfo.asp", function(res) {

            res.on('data', function(d) {
                html += d.toString();
            });

            res.on('end', function() {

                var regex = /<a href="http:..([0-9.]+):25105">/

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
                        
                        Namer.add(devices);

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

    conn.on('getBridges', function() {
        sendBridgeInfo();
    });

    conn.on('getLights', function () {
        getLights();    
    });
    
    conn.on('setLightState', function (id, values) {
        setLightState(id, values);
    });

    conn.on('setLightLevel', function (id, level) {
        setLightLevel(id, level);
    });

    conn.on('getLightState', function (id) {
        getLightState(id);
    });
}

function sendBridgeInfo()
{
    for (var bridge in bridges) {
        conn.emit('bridgeInfo', { name: 'Insteon', id: bridge });
    }
}

function getLights()
{
    var l = [];

    for (var device in lights) {
        l.push({id: device, name: Namer.getName(device)});
    }

    conn.emit('lights', l);
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
    if (!devices.hasOwnProperty(id)) {
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

function getLightState(id)
{
    if (!lights.hasOwnProperty(id)) {
        return;
    }

    var light = lights[id];

    light.level(function(err, level) {
        var on = level > 0;
        conn.emit('lightState', { id: id, state: { on: on, level: level, bri: level }});
    });  
}
