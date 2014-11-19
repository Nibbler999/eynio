
var WeMo = require('wemo');
var Namer = require('../services/namer.js');

var conn, devices = {};

function log(msg)
{
    console.log('[WeMo] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {

        var client = WeMo.Search();

        client.on('found', function(device) {

            devices[device.serialNumber] = {
                name: device.friendlyName,
                dev: new WeMo(device.ip, device.port)
            };

            Namer.add(devices);
        });

        client.once('found', function(device) {
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

    conn.on('getSwitchState', function (id) {
        getSwitchState(id);
    });
}

function getSwitches()
{
    var switches = [];

    for (var device in devices) {
        switches.push({id: device, name: Namer.getName(device)});
    }

    conn.emit('switches', switches);
}

function switchOn(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setBinaryState(1, function(err, result) {

        if (err) {
            log('switchOn:' + err);
            return;
        }

        getSwitchState(id);
    });
}

function switchOff(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setBinaryState(0, function(err, result) {

        if (err) {
            log('switchOff:' + err);
            return;
        }

        getSwitchState(id);
    });
}

function getSwitchState(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.getBinaryState(function(err, result) {

        if (err) {
            log('getSwitchState:' + err);
            return;
        }

        conn.emit('switchState', { id: id, state: { on: result === '1'}});
    });
}
