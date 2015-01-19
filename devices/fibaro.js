
var Fibaro = require('fibaro-api');
var Namer = require('../services/namer.js');

var conn, devices = {}, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Fibaro'});

    conn.once('accepted', function (cfg) {

        Fibaro.discover(function(info) {

            var fibaro = new Fibaro(info.ip, 'admin', 'admin');

            bridges[info.serial] = info;

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

                Namer.add(devices);

                startListening();
            }); 
        }); 
    });
}

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function(cb) {
        sendBridgeInfo(cb);
    });

    conn.on('switchOn', function (id) {
        switchOn(id);    
    });
    
    conn.on('switchOff', function (id) {
        switchOff(id);
    });

    conn.on('getSwitches', function (cb) {
        getSwitches(cb);
    });

    conn.on('getSwitchState', function (id, cb) {
        getSwitchState(id);
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
        bridgeInfo.push({ name: 'Fibaro', id: bridge });
    }

    conn.emit('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getSwitches(cb)
{
    var switches = [];

    for (var device in devices) {
        if (devices[device].type == 'com.fibaro.binarySwitch') {
            switches.push({id: device, name: Namer.getName(device)});
        }
    }

    conn.emit('switches', switches);

    if (cb) cb(switches);
}

function getSensors(cb)
{
    var sensors = [];

    for (var device in devices) {
        if (devices[device].type.match('Sensor')) {
            sensors.push({id: device, name: Namer.getName(device), type: devices[device].type.replace('com.fibaro.', '').replace('Sensor', '')});
        }
    }

    conn.emit('sensors', sensors);

    if (cb) cb(sensors);
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

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSensorValue:' + err);
            if (cb) cb(null);
            return;
        }

        var sensorValue = {
            id: id,
            name: Namer.getName(id),
            type: devices[id].type.replace('com.fibaro.', '').replace('Sensor', ''),
            value: result.properties.value
        };

        conn.emit('sensorValue', sensorValue);
    
        if (cb) cb(sensorValue);
    });
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var deviceId = devices[id].id;

    devices[id].dev.api.devices.get(deviceId, function(err, result) {

        if (err) {
            log('getSwitchState:' + err);
            if (cb) cb(null);
            return;
        }

        var switchState = { on: result.properties.value === '1' };

        conn.emit('switchState', { id: id, state: switchState});

        if (cb) cb(switchState);
    });
}
