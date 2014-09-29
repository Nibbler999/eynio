
var Fibaro = require('fibaro-api');

var conn, devices = {}, fibaro;

function log(msg)
{
    console.log('[Fibaro] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        log('Accepted');

        discovery(function(ip) {

            fibaro = new Fibaro(ip, 'admin', 'admin');

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
    });
}

function discovery(cb)
{
    var server = require('dgram').createSocket("udp4");
    
    server.on('message', function (packet, rinfo) {
        if (packet.toString().match('^ACK HC2-[0-9]+ [0-9:a-f]+$')) {
            cb && cb(rinfo.address);
            server.close();
        }
    });

    server.bind(44444, function () {
        var message = new Buffer("FIBARO");
        server.setBroadcast(true);
        server.send(message, 0, message.length, 44444, "255.255.255.255");
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
