
var lg = require('lg-tv-api');

var conn, devices = {};

function log(msg)
{
    console.log('[LG] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.on('accepted', function (cfg) {
    
        log('Accepted');

        lg.discovery(function(found) {

            for (f in found) {

            	lg.startPairing(found[f].uuid, '965887', function(err, response) {
                    if (err) {
                        console.log(err);
                        console.log(response);
                        return;
                    }

                    startListening();

                });

                log('Found a TV');

                devices[found[f].uuid] = {
                    name: found[f].friendlyName
                };
            }
        });
    });
}

function startListening()
{
    log('Ready for commands');

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

function setVolumeUp(id)
{
    var cmd = '24';

    sendCommand(id, cmd);
}

function setVolumeDown(id)
{
    var cmd = '25';

    sendCommand(id, cmd);
}

function setChannelUp(id)
{
    var cmd = '27';

    sendCommand(id, cmd);
}

function setChannelDown(id)
{
    var cmd = '28';

    sendCommand(id, cmd);
}

function sendCommand(id, cmd)
{
    lg.sendCmd(id, cmd, function(err, response) {
        if (err) {
            log(err);
            log(response);
        }
    });
}
