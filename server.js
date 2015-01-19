var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');

var prettyStdOut = new PrettyStream({mode: 'short'});
prettyStdOut.pipe(process.stdout);

var log = bunyan.createLogger({
    name: 'NHome',
    streams: [{
        level: 'info',
        stream: prettyStdOut
    }]
});

var io = require('socket.io-client');

var serverUrl = 'https://nhome.ba?uuid=' + getUUID();

var serverOptions = {
    'reconnection limit': 18000,
    'max reconnection attempts': Infinity
};

var conn = io.connect(serverUrl, serverOptions);

conn.on('connecting', function(info) {
	log.info('Connecting to NHome...');
});

conn.on('connect', function () {
    log.info('Connected.');
});

conn.on('reconnecting', function(timeout, attempts) {
	log.info('Attempting to reconnect');
});

conn.on('disconnect', function () {
    log.info('Disconnected');
});

conn.on('connect_failed', function() {
    log.error('Failed to connect to NHome');
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
        log.error('Error handling event "' + name + '"');
        log.error(args);
        log.error(e);
    }
}

function getUUID()
{
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

    var uuidFile = require('path').join(home, 'nhome-uuid');

    var fs = require('fs');

    if (!fs.existsSync(uuidFile)) {
        log.info('Generating new uuid');
        var uuid = require('node-uuid').v4();
        fs.writeFileSync(uuidFile, uuid);
    }

    return fs.readFileSync(uuidFile, { encoding: 'utf8'});
}

require('./services/namer.js').listen(conn, log);
require('./services/schedule.js')(conn, log);
require('./services/proxy.js')(conn, log);
require('./services/info.js')(conn, log);
require('./services/mjpeg.js')(conn, log);

require('./devices/hue.js')(conn, log);
require('./devices/wemo.js')(conn, log);
require('./devices/lg.js')(conn, log);
require('./devices/insteon.js')(conn, log);
require('./devices/itach.js')(conn, log);
require('./devices/samsung-remote.js')(conn, log);
require('./devices/fibaro.js')(conn, log);
require('./devices/razberry.js')(conn, log);
require('./devices/lifx.js')(conn, log);
require('./devices/netatmo.js')(conn, log);

process.on('uncaughtException', function (err) {
	log.error('uncaughtException:' + err);
	log.error(err.stack);
});
