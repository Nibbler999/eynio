var io = require('socket.io-client');

var serverUrl = 'https://nhome.ba:8080?uuid=' + getUUID();

var serverOptions = {
    'reconnection limit': 18000,
    'max reconnection attempts': Infinity
};

var conn = io.connect(serverUrl, serverOptions);

conn.on('connecting', function(info) {
	console.log('Connecting to NHome...');
});

conn.on('connect', function () {
    console.log('Connected.');
});

conn.on('reconnecting', function(timeout, attempts) {
	console.log('Attempting to reconnect');
});

conn.on('disconnect', function () {
    console.log('Disconnected');
});

conn.on('connect_failed', function() {
    console.log('Failed to connect to NHome');
});

// Web API
conn.on('message', function (name, args, cb) {

    var data = [], i = 0;

    var numListeners = conn.listeners(name).length;

    if (numListeners === 0) {
        cb(null);
        return;
    }

    var mycb = function(result) {

        if (numListeners === 1) {
            cb(result);
        } else {
            data = data.concat(result);
            if (++i === numListeners) {
                cb(data);
            }
        }
    };

    args.push(mycb);

    conn.emitLocal.apply(conn, [name].concat(args));
});

conn.emitLocal = function (name) {

    var args = Array.prototype.slice.call(arguments, 1);

    var packet = {
        type: 'event',
        name: name,
        args: args
    };

    try {
        this.onPacket(packet);
    } catch (e) {
        console.log('Error handling event "' + name + '"');
        console.log(args);
        console.log(e);
    }
}

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

require('./services/namer.js').listen(conn);
require('./services/schedule.js')(conn);
require('./services/proxy.js')(conn);
require('./services/info.js')(conn);

require('./devices/hue.js')(conn);
require('./devices/wemo.js')(conn);
require('./devices/lg.js')(conn);
require('./devices/insteon.js')(conn);
require('./devices/itach.js')(conn);
require('./devices/samsung-remote.js')(conn);
require('./devices/fibaro.js')(conn);
require('./devices/razberry.js')(conn);
require('./devices/lifx.js')(conn);
require('./devices/netatmo.js')(conn);

process.on('uncaughtException', function (err) {
	console.log('uncaughtException:' + err);
	console.log(err.stack);
});
