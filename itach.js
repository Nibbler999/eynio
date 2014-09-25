var Itach = require('simple-itach');

var conn;

var devices = {};

function log(msg)
{
    console.log('[iTach]', msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        log('Accepted');

        var d = new Itach.discovery();

        d.on('device', function(device) {

            if (!devices.hasOwnProperty(device.UUID)) {

                log('Discovered device');

                devices[device.UUID] = {
                    name: device.Model,
                    dev: new Itach(device.host)
                };
            }
        });

        startListening();
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getRemotes', function () {
        getRemotes();    
    });
    
    conn.on('sendRemoteCommand', function (id, cmd) {
        sendRawCommand(id, cmd);
    });
}

function getRemotes()
{
    var remotes = [];

    for (device in devices) {
        remotes.push({id: device, name: devices[device].name});
    }

    conn.emit('remotes', remotes);
}

function sendRawCommand(id, cmd)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.send(cmd, function (err, res) {
        if (err) {
            log(err);
            return;
          }
    });
}
