
var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var api;

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
    
    conn.on('getStatus', function () {
    
        api.lights(function(err, lights) {
            if (err) throw err;
            conn.emit('status', lights);
        });
    
    });
    
    conn.on('switchOn', function (id) {
    
        var state = lightState.create();
        
        api.setLightState(id, state.on(), function(err, result) {
            if (err) throw err;
            console.log(result);
        });
    
    });
    
    conn.on('switchOff', function (id) {
    
        var state = lightState.create();
        
        api.setLightState(id, state.off(), function(err, result) {
            if (err) throw err;
            console.log(result);
        });
    
    });
}
