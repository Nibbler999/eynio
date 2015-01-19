
var SamsungRemote = require('samsung-remote');

var Namer = require('../services/namer.js');

var conn, devices = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Samsung TV'});

    conn.once('accepted', function (cfg) {

        require('tcp-ping').probe('172.20.15.127', 55000, function(err, available) {

            if (!available) {
                return;
            }

            devices['Samsung-172.20.15.127'] = {
                name: 'Samsung TV',
                dev: new SamsungRemote({ ip: '172.20.15.127'})
            };

            Namer.add(devices);

            startListening();
        });
    });
}

function startListening()
{
    log('Ready for commands');

    conn.on('setPower', function (id) {
        setPower(id);    
    });

    conn.on('setVolumeUp', function (id) {
        setVolumeUp(id);    
    });

    conn.on('setVolumeDown', function (id) {
        setVolumeDown(id);    
    });

    conn.on('setChannelUp', function (id) {
        setChannelUp(id);    
    });

    conn.on('setChannelDown', function (id) {
        setChannelDown(id);    
    });

    conn.on('getMultiMedia', function (cb) {
        getMultiMedia(cb);
    });
}

function getMultiMedia(cb)
{
    var multimedia = [];

    for (var device in devices) {
        multimedia.push({id: device, name: Namer.getName(device)});
    }

    conn.emit('multimedia', multimedia);

    if (cb) cb(multimedia);
}

function setPower(id)
{
    var cmd = 'KEY_POWER';

    sendCommand(id, cmd);
}

function setVolumeUp(id)
{
    var cmd = 'KEY_VOLUP';

    sendCommand(id, cmd);
}

function setVolumeDown(id)
{
    var cmd = 'KEY_VOLDOWN';

    sendCommand(id, cmd);
}

function setChannelUp(id)
{
    var cmd = 'KEY_CHUP';

    sendCommand(id, cmd);
}

function setChannelDown(id)
{
    var cmd = 'KEY_CHDOWN';

    sendCommand(id, cmd);
}

function sendCommand(id, cmd)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.send(cmd, function callback(err) {
        if (err) {
            log(err);
        }
    });
}
