
var Fibaro = require('fibaro-api');

var conn, devices = {};

function log(msg)
{
    console.log('[Fibaro] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {

        Fibaro.discover(function(info) {

            var fibaro = new Fibaro(info.ip, 'admin', 'admin');

            fibaro.api.devices.list(function (err, devicelist) {
    
                if (err) {
                    log(err);
                    return;
                }

                devicelist.forEach(function(device) {

                    if (device.properties.disabled === '1') {
                        return;
                    }

                    devices[info.mac + ':' + device.id] = {
                        id: device.id,
                        name: device.name,
                        type: device.type,
                        dev: fibaro
                    }
                });

                startListening();
            }); 
        }); 
    });
}

function startListening()
{
    log('Ready for commands');

    conn.on('switchOn', function (id) {
        switchOn(id);    
    });
    
    conn.on('switchOff', function (id) {
        switchOff(id);
    });

    conn.on('getSwitches', function () {
        getSwitches();
    });

    conn.on('getSwitchState', function (id) {
        getSwitchState(id);
    });

    conn.on('getSensors', function () {
        getSensors();
    });

    conn.on('getSensorValue', function (id) {
        getSensorValue(id);
    });
}

function getSwitches()
{
    var switches = [];

    for (device in devices) {
        if (devices[device].type == 'binary_light') {
            switches.push({id: device, name: devices[device].name});
        }
    }

    conn.emit('switches', switches);
}

function getSensors()
{
    var sensors = [];

    for (device in devices) {
        if (devices[device].type.match('sensor')) {
            sensors.push({id: device, name: devices[device].name, type: devices[device].type.replace('_sensor', '')});
        }
    }

    conn.emit('sensors', sensors);
}

function switchOn(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.turnOn(deviceId, function(err, result) {

        if (err) {
            log('switchOn:' + err);
            return;
        }

        conn.emit('switchState', { id: id, state: { on: true }});
    });
}

function switchOff(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.turnOff(deviceId, function(err, result) {

        if (err) {
            log('switchOff:' + err);
            return;
        }

        conn.emit('switchState', { id: id, state: { on: false }});
    });
}

function getSensorValue(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSensorValue:' + err);
            return;
        }

        conn.emit('sensorValue', { id: id, name: result.name, type: devices[id].type.replace('_sensor', ''), value: result.properties.value });
    });
}

function getSwitchState(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSwitchState:' + err);
            return;
        }

        conn.emit('switchState', { id: id, state: { on: result.properties.value === '1' }});
    });
}
