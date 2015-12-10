"use strict";

var events = require('events');
var util = require('util');
var cfg = require('./configuration.js');

var wrapper, log;

module.exports = function (l, serverid, uuid) {

    log = l;

    var io = require('socket.io-client');

    var serverUrl = 'https://nhome.ba/server?uuid=' + uuid + '&server=' + serverid;

    log.debug('URL', serverUrl);

    var serverOpts = {
        transports: ['websocket'],
        autoConnect: false
    };

    var conn = io(serverUrl, serverOpts);

    var connect_errors = 0;

    conn.on('connect', function () {
        log.info('Connected.');
        connect_errors = 0;
        conn.io.engine.ping();
        wrapper.emit('connect');
    });

    conn.on('pong', function (ping) {
        wrapper.emit('setPing', ping);
    });

    conn.on('connect_error', function (error) {
        if (connect_errors === 0) {
            log.debug('connect_error', error);
            log.error('Failed to connect to NHome.');
            connect_errors++;
        }
    });

    conn.on('connect_timeout', function () {
        log.debug('connect_timeout');
    });

    conn.on('reconnecting', function (count) {
        if (count === 1) {
            log.info('Attempting to reconnect');
        }
    });

    conn.on('reconnect_error', function (error) {
        log.debug('reconnect_error', error);
    });

    conn.on('reconnect_failed', function () {
        log.debug('reconnect_failed');
    });

    conn.on('disconnect', function () {
        log.error('Disconnected');
        wrapper.emit('disconnect');
    });

    conn.on('command', command_handler);

    wrapper = setupConnWrapper(conn);

    return wrapper;
};

function setupConnWrapper(conn)
{
    var local;

    // Local express + socket.io server
    if (!cfg.get('disableLocalMode', false)) {
        local = setupLocalServer();
    }

    var Wrapper = function () {

        events.EventEmitter.call(this);

        // Emits to both main server and the local server
        this.broadcast = function() {
            this.send.apply(this, arguments);
            this.local.apply(this, arguments);
        };

        // Emits to main server
        this.send = function() {
            conn.emit.apply(conn, arguments);
        };

        // Emits to local server
        this.local = function() {
            if (local && local.server.sockets.length) {
                local.client.emit.apply(local.client, arguments);
            }
        };

        // Handles API command directly (nw.js)
        this.command = function() {

            var args = Array.prototype.slice.call(arguments);
            var name = args.shift();

            var command = {
                user_name: 'Local user',
                name: name,
                args: args
            };

            command_handler(command);
        };

        this.connect = conn.connect.bind(conn);
    };

    util.inherits(Wrapper, events.EventEmitter);

    return new Wrapper();
}

function setupLocalServer()
{
    var server = require('./local.js')(log);

    var server_options = {
        perMessageDeflate: false
    };

    var io = require('socket.io')(server, server_options);

    io.of('/client').use(function(socket, next) {

        var ip = socket.conn.remoteAddress.replace(/^::ffff:/, '');

        if (!require('ip').isPrivate(ip)) {
            next(new Error('Access via local network IP only'));
        } else {
            next();
        }
    });

    var wildcard = require('socketio-wildcard')();

    io.of('/client').use(wildcard);

    io.of('/client').on('connection', function (socket) {

        socket.on('requestStreaming', function (cameraid, options, cb) {

            options.local = true;

            var room = 'camera-' + cameraKey(cameraid, options);

            io.of('/client').to(room).clients(function(error, clients) {

                socket.join(room);

                if (clients.length === 0) {
                    command_handler({name: 'startStreaming', args: [cameraid, options]}, cb);
                } else {
                    if (typeof cb === 'function') {
                        cb(true);
                    }
                }
            });

            socket.setMaxListeners(0);

            socket.on('disconnect', function () {
                io.of('/client').to(room).clients(function(error, clients) {
                    if (clients.length === 0) {
                        command_handler({name: 'stopStreaming', args: [cameraid, options]});
                    }
                });
            });
        });

        socket.on('stopStreaming', function (cameraid, options) {

            options.local = true;

            var room = 'camera-' + cameraKey(cameraid, options);

            socket.leave(room, function() {

                io.of('/client').to(room).clients(function(error, clients) {
                    if (clients.length === 0) {
                        command_handler({name: 'stopStreaming', args: [cameraid, options]});
                    }
                });
            });
        });

        socket.on('startPlayback', function (recordingid, options, cb) {

            options.local = true;

            var playbackid = require('node-uuid').v4();

            var room = 'playback-' + playbackid;

            socket.join(room, function() {
                command_handler({name: 'startPlayback', args: [recordingid, playbackid, options]});
            });

            socket.setMaxListeners(0);

            socket.on('disconnect', function () {
                command_handler({name: 'endPlayback', args: [recordingid]});
            });

            if (typeof cb === 'function') {
                cb(true);
            }
        });

        socket.on('endPlayback', function (playbackid, cb) {

            var room = 'playback-' + playbackid;

            socket.leave(room, function() {
                command_handler({name: 'endPlayback', args: [playbackid]});
            });

            if (typeof cb === 'function') {
                cb(true);
            }
        });

        socket.on('*', function (packet) {

            if (socket.listenerCount(packet.data[0]) !== 0) {
                return;
            }

            var args = packet.data;
            var name = args.shift();
            var mycb, type;

            if (name === 'getDevices' && args.length === 2) {
                type = args.shift();
            }

            var cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;

            if (type) {

                mycb = function (reply) {

                    if (type) {
                        reply = reply.filter(function (device) { return device.type === type; });
                    }

                    if (typeof cb === 'function') {
                        cb(reply);
                    }
                };
            }

            var command = {
                user_id: 0,
                user_name: 'Local user',
                name: name,
                args: args
            };

            command_handler(command, mycb || cb);
        });
    });

    io.of('/server').use(wildcard);

    io.of('/server').on('connection', function (socket) {

        socket.on('cameraFrame', function (frame) {
            io.of('/client').to('camera-' + cameraKey(frame.camera, frame.options)).volatile.emit('cameraFrame', frame);
        });

        socket.on('recordingFrame', function (frame) {
            io.of('/client').to('playback-' + frame.playbackid).volatile.emit('recordingFrame', frame);
        });

        socket.on('playbackEnded', function (playbackid) {
            io.of('/client').to('playback-' + playbackid).volatile.emit('playbackEnded', playbackid);
        });

        socket.on('*', function (packet) {

            var args = packet.data;
            var name = args.shift();

            if (socket.listeners(name).length === 0) {
                io.of('/client').emit.apply(io.of('/client'), [name].concat(args));
            }
        });
    });

    var client = require('socket.io-client');

    var serverUrl = 'http://127.0.0.1:8008/server';

    var serverOpts = {
        transports: ['websocket']
    };

    var conn = client.connect(serverUrl, serverOpts);

    return {
        client: conn,
        server: io.of('/client')
    };
}

function cameraKey(cameraid, options)
{
    if (!options) {
        options = {
            width: -1,
            height: 120,
            framerate: 1
        };
    }

    return [cameraid, options.width, options.height, options.framerate].join('-');
}

function command_handler(command, cb)
{
    log.debug('Received payload:', command);

    command.log = function (deviceid, devicename, action) {

        var entry = {
            user_name: command.user_name,
            id: deviceid,
            device: devicename,
            action: action
        };

        wrapper.emit('appendActionLog', entry);
    };

    if (cb) {

        var combined = [], i = 0, mycb, mycb_timedout, mycb_timer;

        var numListeners = events.EventEmitter.listenerCount(wrapper, command.name);

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

                log.debug('Replied to', command.name, command.args, 'with single handler', result);

                cb(result);
            };

        } else {

            mycb_timedout = function() {
                log.warn('Timeout waiting for', command.name, command.args);
                cb(combined);
            };

            mycb = function(result) {

                if (Array.isArray(result)) {

                    combined = combined.concat(result);

                    if (++i === numListeners) {
                        clearTimeout(mycb_timer);
                        log.debug('Replied to', command.name, command.args, 'with combined result', combined);
                        cb(combined);
                    }

                } else if (result !== undefined) {
                    clearTimeout(mycb_timer);
                    log.debug('Replied to', command.name, command.args, 'with one result', result);
                    cb(result);
                }
            };
        }

        // If device does not respond in 5 seconds return partial result if available or null
        mycb_timer = setTimeout(mycb_timedout, 5000);

        command.args.push(mycb);
    }

    try {
        wrapper.emit(command.name, command);
    } catch (e) {
        log.error('Error handling command', command.name, command.args);
        log.error(e);
    }
}

