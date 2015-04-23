"use strict";

var events = require('events');
var util = require('util');

var wrapper, log;

module.exports = function (l) {

    log = l;

    var io = require('socket.io/node_modules/socket.io-client');

    var serverUrl = 'https://nhome.ba/server?uuid=' + getUUID() + '&version=' + getVersion();

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
    });

    conn.on('command', command_handler);

    // Temporary
    conn.on('proxyConnect', function (proxy) {
        wrapper.emit('proxyConnect', proxy);
    });

    wrapper = setupConnWrapper(conn);

    return wrapper;
};

function setupConnWrapper(conn)
{
    // Local express + socket.io server
    var local = setupLocalServer();

    var Wrapper = function () {

        events.EventEmitter.call(this);

        // Emits to both main server and the local server
        this.broadcast = function() {

            conn.emit.apply(conn, arguments);

            if (local.server.sockets.length) {
                local.client.emit.apply(local.client, arguments);
            }
        };

        // Emits to main server only
        this.send = function() {
            conn.emit.apply(conn, arguments);
        };

        this.connect = conn.connect.bind(conn);
    };

    util.inherits(Wrapper, events.EventEmitter);

    return new Wrapper();
}

function setupLocalServer()
{
    var server = require('./local.js')(log);

    var io = require('socket.io')(server);

    var wildcard = require('socketio-wildcard')();

    io.of('/client').use(wildcard);

    io.of('/client').on('connection', function (socket) {

        socket.on('requestStreaming', function (cameraid, options) {

            // TODO: .clients() support ?
            var room = 'camera-' + cameraKey(cameraid, options);
            socket.join(room);

            command_handler({name: 'startStreaming', args: [cameraid, options]});

            socket.on('disconnect', function () {
                command_handler({name: 'stopStreaming', args: [cameraid, options]});
            });
        });

        socket.on('*', function (packet) {

            var args = packet.data;
            var name = args.shift();

            var cb = typeof(args[args.length - 1]) === 'function' ? args.pop() : null;

            var command = {
                name: name,
                args: args
            };

            command_handler(command, cb);
        });
    });

    io.of('/server').use(wildcard);

    io.of('/server').on('connection', function (socket) {

        socket.on('cameraFrame', function (frame) {
            io.of('/client').to('camera-' + cameraKey(frame.camera, frame.options)).emit('cameraFrame', frame);
        });

        socket.on('*', function (packet) {

            var args = packet.data;
            var name = args.shift();

            if (socket.listeners(name).length === 0) {
                io.of('/client').emit.apply(io.of('/client'), [name].concat(args));
            }
        });
    });

    var client = require('./node_modules/socket.io/node_modules/socket.io-client');

    var serverUrl = 'http://127.0.0.1:8080/server';

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
    if (!options) options = {
        width: -1,
        height: 120,
        framerate: 1
    };

    return [cameraid, options.width, options.height, options.framerate].join('-');
}

function command_handler(command, cb)
{
    log.debug('Received payload:', command);

    if (command.permissions) {

        var permissions = require('./permissions.js');

        if (!permissions.permitted_command(command)) {
            if (cb) cb(false);
            return false;
        }
    }

    command.log = function (device, action) {

        var entry = {
            user: command.user,
            device: device,
            action: action
        };

        wrapper.send('appendActionLog', entry);
    };

    if (cb) {

        var data = [], i = 0, mycb, mycb_timedout, mycb_timer;

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

    try {
        wrapper.emit(command.name, command);
    } catch (e) {
        log.error('Error handling command', command.name, command.args);
        log.error(e);
    }
}

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

function getVersion()
{
    delete require.cache[require.resolve('./package.json')];
    return require('./package.json').version;
}

