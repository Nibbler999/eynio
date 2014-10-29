
var SamsungRemote = require('samsung-remote');

var conn, devices = {};

function log(msg)
{
    console.log('[Samsung TV] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {

        var dev = new SamsungRemote({ ip: '172.20.15.127'});

        dev.isAlive(function(status) {

            if (!status) {
                console.log(':(');
                return;
            }

            devices['Samsung-172.20.15.127'] = {
                name: 'Samsung TV',
                dev: dev
            };

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

    conn.on('getMultiMedia', function () {
        getMultiMedia();
    });
}

function getMultiMedia()
{
    var multimedia = [];

    for (device in devices) {
        multimedia.push({id: device, name: devices[device].name});
    }

    conn.emit('multimedia', multimedia);
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
