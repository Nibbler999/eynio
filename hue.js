
var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var api;

function setLightState(id, values)
{
    var state = lightState.create();
    
    if (values.hasOwnProperty('rgb')) {
        state = state.rgb(values.rgb[0], values.rgb[1], values.rgb[2]);
        values.hue = state.hue;
        values.sat = state.sat;
        values.bri = state.bri;
        delete values.rgb;
    }

    api.setLightState(id, values, function(err, result) {
        if (err) {
            console.log(err);
            return;
        }
        console.log(result);
    });
}

function getLightState(id)
{
    api.lightStatus(id, function(err, result) {
        if (err) {
            console.log(err);
            return;
        }
        conn.emit('lightState', result.state);
    });
}

module.exports = function(conn) {

    conn.on('accepted', function (cfg) {
    
        console.log('Accepted');
    
        hue.locateBridges(function(err, result) {
    
            if (err) {
                console.log('locateBridges', err);
                return;
            }
    
            if (result.length == 0) {
                console.log('No hue bridges found');
                return;
            }
    
            api = new HueApi(result[0].ipaddress, cfg.hue_apikey);
            api.connect(function(err, config) {
                if (err) {
                    console.log(err);
                    return;
                }
                if (!config.hasOwnProperty('ipaddress')) {
                    console.log('Need to create user');
                    conn.emit('pushthebutton', config.name);
                    var registerInterval = setInterval(function () {
                        console.log('Creating user');
                        api.createUser(result[0].ipaddress, null, 'NHome', function(err, user) {
                            if (err) {
                                console.log(err);
                                return;
                            }
                            clearInterval(registerInterval);
                            console.log('User ' + user + ' created');
                            api = new HueApi(result[0].ipaddress, user);
                            // Send username to web server
                            conn.emit('setConfig', { hue_apikey: user});
                        });
                    }, 5000);
                } else {
                    console.log('Authentication ok');
                }
            });
        });
    });
    
    conn.on('getLights', function () {
    
        api.lights(function(err, lights) {
            if (err) {
                console.log(err);
                return;
            }
            conn.emit('lights', lights);
        });
    
    });
    
    conn.on('setLightState', function (id, values) {
        setLightState(id, values);
    });

    conn.on('getLightState', function (id) {
        getLightState(id);
    });
}
