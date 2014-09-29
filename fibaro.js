
var ip = '172.20.15.148';

var Fibaro = require('fibaro-api');

var fibaro = new Fibaro(ip, 'admin', 'admin');

var conn, devices = {};

function log(msg)
{
    console.log('[Fibaro] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        log('Accepted');

        fibaro.api.devices.list(function (err, devicelist) {

            if (err) {
                log(err);
                return;
            }

            devicelist.forEach(function(device) {
                devices['fibaro:' + ip + ':' + device.id] = device;
            });

            startListening();
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
            sensors.push({id: device, name: devices[device].name});
        }
    }

    console.log(sensors);

    conn.emit('sensors', sensors);
}

function switchOn(id)
{
    var deviceId = devices[id].id;

    fibaro.api.devices.turnOn(deviceId, function(err, result) {
        if (err) {
            log('switchOn:' + err);
        }
    });
}

function switchOff(id)
{
    var deviceId = devices[id].id;

    fibaro.api.devices.turnOff(deviceId, function(err, result) {
        if (err) {
            log('switchOff:' + err);
        }
    });
}

function getSensorValue(id)
{
    var deviceId = devices[id].id;

    fibaro.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSensorValue:' + err);
            return;
        }

        conn.emit('sensorValue', { id: id, value: result.properties.value });
    });
}
