
module.exports = function(log) {

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

    conn.on('log', function (cb) {
    
        var PrettyStream = require('bunyan-prettystream');
    
        var prettyLog = new PrettyStream({mode: 'short', useColor: false});
    
        var ringbuffer = log.streams[1].stream;

        var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');
    
        cb && cb(entries);
    });

    conn.emitLocal = function (name) {
    
        try {
            io.EventEmitter.prototype.emit.apply(this, arguments);
        } catch (e) {
            log.error('Error handling event "' + name + '"');
            log.error(arguments);
            log.error(e);
        }
    }

    return conn;
};

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
