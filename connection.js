"use strict";

module.exports = function (log) {

    var io = require('socket.io-client');
    
    var serverUrl = 'https://nhome.ba/server?uuid=' + getUUID();
    
    log.debug('URL', serverUrl);
   
    var serverOpts = {
        transports: ['websocket']
    };
    
    var conn = io(serverUrl, serverOpts);
    
    log.info('Connecting...');

    conn.on('connect', function () {
        log.info('Connected.');
    });
    
    conn.on('connect_error', function () {
        log.error('Failed to connect to NHome.');
    });

    conn.on('reconnecting', function() {
        log.info('Attempting to reconnect');
    });

    conn.on('disconnect', function () {
        log.error('Disconnected');
    });

    conn.on('command', function (command, cb) {
    
        log.debug('Received payload:', command);

        if (command.permissions) {

            var permissions = require('./permissions.js');

            if (!permissions.permitted_command(command)) {
                if (cb) cb(false);
                return false;
            }
        }

        if (cb) {

            var data = [], i = 0, mycb, mycb_timedout, mycb_timer;
        
            var numListeners = conn.listeners(command.name).length;
        
            if (numListeners === 0) {
                log.debug('Replied to', command.name, command.args, 'with empty response');
                cb(null);
                return;
            } else if (numListeners === 1) {
            
                mycb_timedout = function() {
                    log.warn('Timeout waiting for', command.name, command.args);
                    cb(null);
                };

                mycb = function(result) {
                    
                    clearTimeout(mycb_timer);
                    
                    if (command.permissions) {
                        result = permissions.filter_response(command, result);
                    }

                    log.debug('Replied to', command.name, command.args, 'with result', result);
                    
                    cb(result);
                };
            
            } else {
                    
                mycb_timedout = function() {
                    log.warn('Timeout waiting for', command.name, command.args);
                    cb(data);
                };
                
                mycb = function(result) {
                    
                    if (command.permissions) {
                        result = permissions.filter_response(command, result);
                    }

                    data = data.concat(result);
                    
                    if (++i === numListeners) {
                        clearTimeout(mycb_timer);
                        log.debug('Replied to', command.name, command.args, 'with result array', data);
                        cb(data);
                    }
                };
            }

            // If device does not respond in 5 seconds return partial result if available or null
            mycb_timer = setTimeout(mycb_timedout, 5000);
            
            command.args.push(mycb);
        }

        conn.emitLocal.apply(conn, [command.name].concat(command.args));
    });
    
    conn.on('log', function (cb) {
    
        var PrettyStream = require('bunyan-prettystream');
    
        var prettyLog = new PrettyStream({mode: 'short', useColor: false});
    
        var ringbuffer = log.streams[1].stream;

        var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');
    
        conn.emit('log', entries);

        if (cb) cb(entries);
    });

    conn.emitLocal = function (name) {
    
        try {
            io.Manager.prototype.emit.apply(this, arguments);
        } catch (e) {
            log.error('Error handling event', name, Array.prototype.slice.call(arguments, 1));
            log.error(e);
        }
    };

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
