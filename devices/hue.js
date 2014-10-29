
var hue = require("node-hue-api"),
    HueApi = hue.HueApi,
    lightState = hue.lightState;

var api, conn;

function log(msg)
{
    console.log('[Hue] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        hue.locateBridges(function(err, result) {
    
            if (err) {
                log('locateBridges: ' + err);
                return;
            }
    
            if (result.length == 0) {
                return;
            }
    
            log('Found a bridge');

            api = new HueApi(result[0].ipaddress, cfg.hue_apikey || 'none');

            api.connect(function(err, config) {

                if (err) {
                    log('connect: ' + err);
                    return;
                }

                // If auth failed this property is missing
                if (!config.hasOwnProperty('ipaddress')) {

                    log('Need to create user');
                    conn.emit('pushthebutton', config.name);

                    var registerInterval = setInterval(function () {
                        log('Creating user');
                        api.createUser(result[0].ipaddress, null, 'NHome', function(err, user) {
                            if (err) {
                                log('createUser: ' + err);
                                return;
                            }
                            clearInterval(registerInterval);
                            log('User ' + user + ' created');

                            // Connect with newly created user
                            api = new HueApi(result[0].ipaddress, user);

                            // Send username to web server
                            conn.emit('setConfig', { hue_apikey: user});

                            startListening();

                            getLights();
                        });
                    }, 5000);

                } else {
                    log('Authentication ok');
                    startListening();
                }
            });
        });
    });
}

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
    api.lights(function(err, lights) {
        if (err) {
            log('api.lights: ' + err);
            return;
        }
        conn.emit('lights', lights);
    });
}

function setLightState(id, values)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var state = lightState.create();
    
    if (values.hasOwnProperty('rgb')) {
        state = state.rgb.apply(state, values.rgb);
        values.hue = state.hue;
        values.sat = state.sat;
        values.bri = state.bri;
        delete values.rgb;
    }

    api.setLightState(id, values, function(err, result) {

        if (err) {
            log('api.setLightState:' + err);
            return;
        }

        if (result) {
            getLightState(id);
        }
    });
}

function getLightState(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    api.lightStatus(id, function(err, result) {
        if (err) {
            log('api.lightStatus: ' + err);
            return;
        }
        conn.emit('lightState', { id: id, state: result.state });
    });
}
