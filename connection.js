"use strict";

module.exports = function (log) {

    var io = require('socket.io-client');
    
    var serverUrl = 'https://nhome.ba?uuid=' + getUUID();
    
    log.debug('URL', serverUrl);

    var serverOptions = {
        'reconnection limit': 18000,
        'max reconnection attempts': Infinity
    };
    
    var conn = io.connect(serverUrl, serverOptions);
    
    conn.on('connecting', function() {
    	log.info('Connecting...');
    });
    
    conn.on('connect', function () {
        log.info('Connected.');
    });
    
    conn.on('reconnecting', function() {
    	log.info('Attempting to reconnect');
    });
    
    conn.on('disconnect', function () {
        log.info('Disconnected');
    });
    
    conn.on('connect_failed', function() {
        log.error('Failed to connect to NHome');
    });
    
    conn.on('message', function (name, args, cb) {
    
        log.debug('Received:', name, args);

        if (cb) {

            var data = [], i = 0;
        
            var numListeners = conn.listeners(name).length;
        
            if (numListeners === 0) {
                log.debug('Replied to', name, args, 'with empty response');
                cb(null);
                return;
            }
        
            var mycb = function(result) {
        
                if (numListeners === 1) {
                    log.debug('Replied to', name, args, 'with result', result);
                    cb(result);
                } else {
                    data = data.concat(result);
                    if (++i === numListeners) {
                        log.debug('Replied to', name, args, 'with result array', data);
                        cb(data);
                    }
                }
            };
        
            args.push(mycb);
        }

        conn.emitLocal.apply(conn, [name].concat(args));
    });

    conn.on('log', function (cb) {
    
        var PrettyStream = require('bunyan-prettystream');
    
        var prettyLog = new PrettyStream({mode: 'short', useColor: false});
    
        var ringbuffer = log.streams[1].stream;

        var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');
    
        if (cb) cb(entries);
    });

    conn.emitLocal = function (name) {
    
        try {
            io.EventEmitter.prototype.emit.apply(this, arguments);
        } catch (e) {
            log.error('Error handling event', name, Array.prototype.slice.call(arguments, 1));
            log.error(e);
        }
    };

    if (log.debug()) {

        var emit_orig = conn.emit;
    
        conn.emit = function () {

            var args = Array.prototype.slice.call(arguments);
            args.unshift('Emitted event');
            log.debug.apply(log, args);

            emit_orig.apply(conn, arguments);
        };
    
        var on_orig = io.SocketNamespace.prototype.$emit;
    
        io.SocketNamespace.prototype.$emit = function (name) {

            if (name !== 'message') {
                var args = Array.prototype.slice.call(arguments);
                args.unshift('Received event');
                log.debug.apply(log, args);
            }

            on_orig.apply(conn, arguments);
        };
    }

    return conn;
};

function getUUID()
{
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

    var uuidFile = require('path').join(home, 'nhome-uuid');

    var fs = require('fs');

    if (!fs.existsSync(uuidFile)) {
        //log.info('Generating new uuid');
        var uuid = require('node-uuid').v4();
        //log.debug(uuid);
        fs.writeFileSync(uuidFile, uuid);
    }

    return fs.readFileSync(uuidFile, { encoding: 'utf8'});
}
