"use strict";

var Itach = require('simple-itach');

var Namer = require('../services/namer.js');

var conn;

var devices = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'iTach'});

    var d = new Itach.discovery();

    d.on('device', function(device) {

        if (!devices.hasOwnProperty(device.UUID)) {

            log('Discovered device');

            devices[device.UUID] = {
                name: device.Model,
                dev: new Itach(device.host)
            };

            Namer.add(devices);
        }
    });

    d.once('device', function() {
        startListening();
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getRemotes', function (command) {
        getRemotes.apply(command, command.args);
    });

    conn.on('sendRemoteKey', function () {
        sendRemoteKey.apply(null, arguments);
    });

    conn.on('learnRemoteKey', function () {
        learnRemoteKey.apply(null, arguments);
    });
}

function getRemotes(cb)
{
    var r = [];

    for (var device in devices) {
        r.push({
            id: device,
            name: Namer.getName(device),
            module: 'itach'
        });
    }

    conn.broadcast('remotes', r);

    if (typeof cb === 'function') {
        cb(r);
    }
}

function sendRemoteKey(remote, code, cb)
{
    if (!devices.hasOwnProperty(remote.deviceid)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var cmd = code.replace('1:1', remote.connector) + '\r';

    devices[remote.deviceid].dev.send(cmd, function (err) {
        if (err) {
            log(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }
        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function learnRemoteKey(deviceid, cb)
{
    if (!devices.hasOwnProperty(deviceid)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    devices[deviceid].dev.learn(function (err, res) {

        if (err) {
            log('Learn error: ' + err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        cb(res);
    });
}

Itach.learn = function (callback) {
    var err;
    var socket = new require('net').Socket();
    var res = '';
    var re = /^sendir,\d:\d,\d+,/

    if (!this.host) {
        return callback(new Error('No host'));
    }

    socket.setEncoding('ASCII');
    socket.connect(4998, this.host);
    socket.on('data', function (chunk) {

        if (chunk === 'IR Learner Enabled\r') {
            return;
        }

        res += chunk;

        if (chunk[chunk.length - 1] == "\n") {
            res = res.replace(re, 'sendir,1:1,1,').trim();
            callback(null, res);
            socket.write('stop_IRL\r');
            socket.end();
        }
    });
    socket.on('error', function (error) {
        err = error; // error with connection, closes socket
    });
    socket.on('close', function () {
        if (err) {
            return callback(err);
        }
    });
    socket.write('get_IRL\r', 'ASCII');
};

Itach.discovery = function () {

    events.EventEmitter.call(this);

    var self = this;

    var server = require('dgram').createSocket("udp4");

    var re = /<-(.+?)=(.+?)>/g;

    server.bind(9131, function () {
        server.addMembership('239.255.250.250');
    });

    server.on('message', function (packet, rinfo) {

        if (rinfo.port === 9131) {

            var matches = [], device = {};

            while ((matches = re.exec(packet.toString())) !== null) {
                device[matches[1]] = matches[2];
            }

            device.host = rinfo.address;

            self.emit('device', device);
        }
    });
};

var events = require('events');

require('util').inherits(Itach.discovery, events.EventEmitter);

