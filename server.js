var io = require('socket.io-client');

var serverUrl = 'https://nhome.neosoft.ba:8080';
var conn = io.connect(serverUrl);

conn.on('connect', function () {

    console.log('Connected to socket.io');

    conn.emit('serverhello', { uuid: getUUID() });
});

conn.on('disconnect', function () {
    console.log('disconnected');
});

function getUUID()
{
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

    var uuidFile = require('path').join(home, 'nhome-uuid');

    var fs = require('fs');

    if (!fs.existsSync(uuidFile)) {
        console.log('Generating new uuid');
        var uuid = require('node-uuid').v4();
        fs.writeFileSync(uuidFile, uuid);
    }

    return fs.readFileSync(uuidFile, { encoding: 'utf8'});
}

require('./hue.js')(conn);
require('./wemo.js')(conn);
//require('./upnp.js')(conn);
require('./lg.js')(conn);
require('./insteon.js')(conn);
require('./itach.js')(conn);
require('./samsung-remote.js')(conn);
require('./fibaro.js')(conn);

process.on('uncaughtException', function (err) {
	console.log('uncaughtException:' + err);
	console.log(err.stack);
});
