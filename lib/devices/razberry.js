"use strict";

var Namer = require('../services/namer.js');
var cfg = require('../configuration.js');

var net = require('net');
var tcpp = require('tcp-ping');
var get = require('simple-get');
var cookie;

var conn, devices = {}, ip, bridges = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'RaZberry'});

    get.concat({ url: 'https://find.z-wave.me/zboxweb' }, function (error, response, body) {

        if (!error && response.statusCode === 200) {

            var regex = /<a href="http:..([0-9.]+):808.">/;

            var matches = regex.exec(body);

            if (!matches) {
                return;
            }

            ip = matches[1];

            tcpp.probe(ip, 8083, function (err, available) {

                if (err) {
                    logger.debug(err);
                }

                if (available) {

                    bridges['raz:' + ip] = ip;

                    login(ip, 'admin', 'admin');

                } else {
                    logger.debug('Found ip', ip, 'but it was not reachable');
                }
            });
        }
    });
};

function startListening()
{
    logger.info('Ready for commands');

    conn.on('getBridges', function (command) {
        getBridges.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('switchOn', function (command) {
        switchOn.apply(command, command.args);
    });

    conn.on('switchOff', function (command) {
        switchOff.apply(command, command.args);
    });

    conn.on('getSwitchState', function (command) {
        getSwitchState.apply(command, command.args);
    });

    conn.on('getDevicePowerState', function (command) {
        getDevicePowerState.apply(command, command.args);
    });

    conn.on('setDevicePowerState', function (command) {
        setDevicePowerState.apply(command, command.args);
    });

    conn.on('toggleDevicePowerState', function (command) {
        toggleDevicePowerState.apply(command, command.args);
    });
}

function login(ip, username, password)
{
    var data = JSON.stringify({
        form: true,
        login: username,
        password: password,
        keepme: false,
        default_ui: 1
    });

    var client = net.connect(8083, ip, function() {
        client.write('POST /ZAutomation/api/v1/login HTTP/1.1\r\n');
        client.write('Accept: application/json\r\n');
        client.write('Content-Type: application/json\r\n');
        client.write('Connection: close\r\n\r\n');
        client.write(data + '\r\n');
    });

    var responseText = '';

    client.on('data', function (data) {
        responseText += data.toString();
    });

    client.on('end', function () {

        var regex = /Set-Cookie: ZWAYSession=(.+);/;

        var matches = regex.exec(responseText);

        if (!matches) {
            return;
        }

        cookie = matches[1];

        update(startListening);
    });
}

function makeRequest(path, cb)
{
    path = encodeURI(path);

    var client = net.connect(8083, ip, function() {
        client.write('GET ' + path + ' HTTP/1.1\r\n');
        client.write('Cookie: ZWAYSession=' + cookie + '\r\n');
        client.write('Connection: close\r\n');
        client.write('\r\n');
    });

    var responseText = '';

    client.on('data', function (data) {
        responseText += data.toString();
    });

    client.on('error', function (err) {
        cb(err);
    });

    client.on('end', function () {

        var start = responseText.indexOf('{');
        var end = responseText.lastIndexOf('}');

        if (start === -1 || end === -1) {
            cb(null, true);
            return;
        }

        var data = responseText.substring(start, end + 1);

        var responseJSON;

        try {
            responseJSON = JSON.parse(data);
        } catch (err) {
            cb(err);
            return;
        }

        cb(null, responseJSON);
    });
}

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: 'RaZberry',
            module: 'razberry',
            id: bridge,
            ip: null,
            mac: null,
            blacklisted: blacklist.indexOf(bridge) !== -1
        });
    }

    if (typeof cb === 'function') {
        cb(bridgeInfo);
    }
}

function getDevices(cb)
{
    update(function() {

        var all = [];

        for (var device in devices) {
            if (devices[device].commandClasses.hasOwnProperty('37')) {
                all.push({
                    id: device,
                    name: Namer.getName(device),
                    type: 'switch',
                    module: 'razberry'
                });
            }
        }

        if (typeof cb === 'function') {
            cb(all);
        }
    });
}

function switchOn(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var device = devices[id].id;
    var self = this;

    makeRequest('/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(255)', function (err) {

        if (err) {
            logger.error(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'switch-on');

        conn.broadcast('switchState', { id: id, state: { on: true }});

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function switchOff(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var device = devices[id].id;
    var self = this;

    makeRequest('/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(0)', function (err) {

        if (err) {
            logger.error(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        self.log(id, Namer.getName(id), 'switch-off');

        conn.broadcast('switchState', { id: id, state: { on: false }});

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function setDevicePowerState(id, on, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (on) {
        switchOn.call(this, id, cb);
    } else {
        switchOff.call(this, id, cb);
    }
}

function getDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    getSwitchState(id, function (state) {
        if (typeof cb === 'function') {
            cb(state.on);
        }
    });
}

function toggleDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var self = this;

    getDevicePowerState(id, function (state) {
        setDevicePowerState.call(self, id, !state, cb);
    });
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    update(function() {
        var switchState = { on: devices[id].commandClasses['37'].data.level.value};
        conn.broadcast('switchState', { id: id, state: switchState});
        if (typeof cb === 'function') {
            cb(switchState);
        }
    });
}

function update(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    if (blacklist.indexOf('raz:' + ip) !== -1) {
        devices = {};
        return;
    }

    makeRequest('/ZWaveAPI/Data/0', function (err, response) {

        if (err) {
            logger.error(err);
            return;
        }

        devices = {};

        for (var d in response.devices) {

            if (d === '1') {
                continue;
            }

            devices['razberry-' + d] = {
                id: d,
                name: 'Device ' + d,
                commandClasses: response.devices[d].instances[0].commandClasses
            };
        }

        Namer.add(devices);

        if (typeof cb === 'function') {
            cb();
        }
    });
}
