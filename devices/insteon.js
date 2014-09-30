var Insteon = require('home-controller').Insteon;

var insteon = new Insteon();

var api, conn;

var lights = {};

function log(msg)
{
    console.log('[Insteon] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        log('Accepted');
    
        var html = '';

        require('http').get("http://connect.insteon.com/getinfo.asp", function(res) {

            res.on('data', function(d) {
                html += d.toString();
            });

            res.on('end', function() {

                var regex = /<a href="http:..([0-9.]+):25105">/

                var matches = regex.exec(html);

                if (!matches) {
                    log('No hub found');
                    return;
                }

                var host = matches[1];

                log('Hub found');

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

    conn.on('getLights', function () {
        getLights();    
    });
    
    conn.on('setLightState', function (id, values) {
        setLightState(id, values);
    });

    conn.on('getLightState', function (id) {
        getLightState(id);
    });
}

function getLights()
{
    var l = {lights: []};

    for (device in lights) {
        l.lights.push({id: device, name: device});
    }

    conn.emit('lights', l);
}

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

function getLightState(id)
{
    if (!lights.hasOwnProperty(id)) {
        return;
    }

    var light = lights[id];

    light.level(function(err, level) {
        var on = level > 0;
        conn.emit('lightState', { id: id, state: { on: on, bri: level }});
    });  
}
