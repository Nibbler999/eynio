"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');
var cfg = require('../configuration.js');

var conn, devices = {}, ip, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'RaZberry'});

    require('request')('http://find.z-wave.me/', function (error, response, body) {

        if (!error && response.statusCode === 200) {

            var regex = /<a href="http:..([0-9.]+):808.">/;

            var matches = regex.exec(body);

            if (!matches) {
                return;
            }

            ip = matches[1];

            bridges['raz:' + ip] = ip;

            update(startListening);
        }
    });
};

function startListening()
{
    log('Ready for commands');

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

    conn.on('setDevicePowerState', function (command) {
        setDevicePowerState.apply(command, command.args);
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

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (cb) cb(bridgeInfo);
}

function getDevices(cb)
{
    var blacklist = cfg.get('blacklist_devices', []);

    update(function() {

        var all = [];

        for (var device in devices) {
            if (devices[device].commandClasses.hasOwnProperty('37')) {
                all.push({
                    id: device,
                    name: Namer.getName(device),
                    categories: Cats.getCats(device),
                    type: 'switch',
                    blacklisted: blacklist.indexOf(device) !== -1
                });
            }
        }

        if (cb) cb(all);
    });
}

function switchOn(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var device = devices[id].id;
    var self = this;

    require('request')('http://' + ip + ':8083/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(255)', function(err, response) {

        if (err) {
            log(err);
            if (cb) cb(false);
            return;
        }

        if (response.statusCode === 200) {
            self.log(Namer.getName(id), 'switch-on');
            conn.broadcast('switchState', { id: id, state: { on: true }});
            if (cb) cb(true);
        } else {
            log('switchOn', response.statusCode);
            if (cb) cb(false);
        }
    });
}

function switchOff(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    var device = devices[id].id;
    var self = this;

    require('request')('http://' + ip + ':8083/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(0)', function(err, response) {

        if (err) {
            log(err);
            if (cb) cb(false);
            return;
        }

        if (response.statusCode === 200) {
            self.log(Namer.getName(id), 'switch-off');
            conn.broadcast('switchState', { id: id, state: { on: false }});
            if (cb) cb(true);
        } else {
            log('switchOn', response.statusCode);
            if (cb) cb(false);
        }
    });
}

function setDevicePowerState(id, on, cb)
{
    if (on) {
        switchOn.call(this, id, cb);
    } else {
        switchOff.call(this, id, cb);
    }
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
        return;
    }

    update(function() {
        var switchState = { on: devices[id].commandClasses['37'].data.level.value};
        conn.broadcast('switchState', { id: id, state: switchState});
        if (cb) cb(switchState);
    });
}

function update(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    if (blacklist.indexOf('raz:' + ip) !== -1) {
        return;
    }

    require('request')('http://' + ip + ':8083/ZWaveAPI/Data/0', function(err, response, body) {

        if (err) {
            log(err);
            return;
        }

        if (response.statusCode !== 200) {
            log('ZWaveAPI/Data failure', body.trim());
            return;
        }

        var status = JSON.parse(body);

        for (var d in status.devices) {

            if (d === '1') {
                continue;
            }

            devices['razberry-' + d] = {
                id: d,
                name: 'Device ' + d,
                commandClasses: status.devices[d].instances[0].commandClasses
            };
        }

        Namer.add(devices);

        if (cb) cb();
    });
}
