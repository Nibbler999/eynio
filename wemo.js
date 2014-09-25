
var WeMo = require('wemo');

var conn, devices = {};

function log(msg)
{
    console.log('[WeMo] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        log('Accepted');

        var client = WeMo.Search();

        client.on('found', function(device) {
            devices[device.serialNumber] = {
                name: device.friendlyName,
                dev: new WeMo(device.ip, device.port)
            };
        });

        startListening();
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
}

function getSwitches()
{
    var switches = [];

    for (device in devices) {
        switches.push({id: device, name: devices[device].name});
    }

    conn.emit('switches', switches);
}

function switchOn(id)
{
    devices[id].dev.setBinaryState(1, function(err, result) {
        if (err) {
            log('switchOn:' + err);
        }
    });
}

function switchOff(id)
{
    devices[id].dev.setBinaryState(0, function(err, result) {
        if (err) {
            log('switchOff:' + err);
        }
    });
}
