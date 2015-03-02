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
        transports: ['websocket']
    };

    var conn = io(serverUrl, serverOpts);

    log.info('Connecting...');

    conn.on('connect', function () {
        log.info('Connected.');
    });

    conn.once('connect_error', function (error) {
        log.debug('connect_error', error);
        log.error('Failed to connect to NHome.');
    });

    conn.on('reconnecting', function (count) {
        if (count === 1) {
            log.info('Attempting to reconnect');
        }
    });

    conn.on('disconnect', function () {
        log.error('Disconnected');
    });

    conn.on('command', command_handler);

    // Temporary
    conn.on('makeMJPEG', function (camera) {
        wrapper.emitLocal('makeMJPEG', camera);
    });

    // Temporary
    conn.on('proxyConnect', function (proxy) {
        wrapper.emitLocal('proxyConnect', proxy);
    });

    conn.on('log', function (cb) {

        var PrettyStream = require('bunyan-prettystream');

        var prettyLog = new PrettyStream({mode: 'short', useColor: false});

        var ringbuffer = log.streams[1].stream;

        var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');

        conn.broadcast('log', entries);

        if (cb) cb(entries);
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
            local.emit.apply(local, arguments);
        };

        // Emits to main server only
        this.send = function() {
            conn.emit.apply(conn, arguments);
        };

        // Emits an event locally as if it came from the main server
        this.emitLocal = function () {
            this.emit.apply(this, arguments);
        };
    };

    util.inherits(Wrapper, events.EventEmitter);

    return new Wrapper();
}

function setupLocalServer()
{
    var server = require('./local.js')(log);

    var io = require('socket.io')(server).of('/client');

    var wildcard = require('socketio-wildcard')();

    io.use(wildcard);

    io.on('connection', function (socket) {

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

    return io;
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

    wrapper.emitLocal.apply(wrapper, [command.name].concat(command.args));
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

