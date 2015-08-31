"use strict";

var WeMo = require('wemo');

var Namer = require('../services/namer.js');

var conn, devices = {}, subscriptions = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'WeMo'});

    var client = WeMo.Search();

    client.on('found', function(device) {

        if (device.deviceType === 'urn:Belkin:device:bridge:1') {

            var bridge = new WeMo(device);

            bridge.GetEndDevices(function (err, devicelist) {

                if (err) {

                    logger.error('Unable to get device list from bridge', err);

                } else {

                    devicelist.forEach(function (d) {

                        devices[d.id] = {
                            name: d.name,
                            type: 'light',
                            subtype: '',
                            state: {
                                on: d.on,
                                hsl: [0, 0, d.level / 510],
                                hex: '#ffffff'
                            },
                            dev: bridge
                        };
                    });

                    Namer.add(devices);
                }
            });

        } else {

            devices[device.serialNumber] = {
                name: device.friendlyName,
                type: device.deviceType === 'urn:Belkin:device:sensor:1' ? 'sensor' : 'switch',
                subtype: device.type === 'sensor' ? 'motion' : '',
                value: device.binaryState === '1',
                dev: new WeMo(device)
            };

            Namer.add(devices);

            subscribe(device);
        }
    });

    client.once('found', function() {
        startListening();
        startUPnPServer();
    });
};

function startListening()
{
    logger.info('Ready for commands');

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

    conn.on('getSensorValue', function (command) {
        getSensorValue.apply(command, command.args);
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

    conn.on('setLightState', function (command) {
        setLightState.apply(command, command.args);
    });

    conn.on('setLightWhite', function (command) {
        setLightWhite.apply(command, command.args);
    });
}

function subscribe(device)
{
    var ipaddress = require('ip').address();

    var subscribeoptions = {
        host: device.ip,
        port: device.port,
        path: '/upnp/event/basicevent1',
        method: 'SUBSCRIBE',
        headers: {
            'CALLBACK': '<http://' + ipaddress + ':3001/>',
            'NT': 'upnp:event',
            'TIMEOUT': 'Second-600'
        }
    };

    var sub_request = require('http').request(subscribeoptions, function(res) {
        subscriptions[res.headers.sid] = device.serialNumber;
        setTimeout(subscribe, 600 * 1000, device);
    });

    sub_request.on('error', function (e) {
        logger.error('event subscription error', e);
    });

    sub_request.end();
}

function startUPnPServer()
{
    var http = require('http');

    http.createServer(function (req, res) {

        var data = '';

        req.setEncoding('utf8');

        req.on('data', function(chunk) {
            data += chunk;
        });

        req.on('end', function() {

            var id = subscriptions[req.headers.sid];

            if (!id) {
                return;
            }

            require('xml2js').parseString(data, function(err, json) {

                if (err) {
                    logger.error(err);
                    logger.error(data);
                }

                var property = json['e:propertyset']['e:property'][0];

                for (var p in property) {

                    if (p === 'BinaryState') {

                        var value = parseInt(property[p][0], 10);
                        var device = devices[id];

                        device.value = value >= 1;

                        if (device.type === 'switch') {

                            var switchState = { on: device.value };

                            conn.broadcast('switchState', { id: id, state: switchState});

                        } else if (device.type === 'sensor') {

                            var sensorValue = {
                                id: id,
                                name: Namer.getName(id),
                                type: 'motion',
                                value: device.value
                            };

                            conn.broadcast('sensorValue', sensorValue);
                        }
                    }
                }
            });

            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('OK\n');
        });

    }).listen(3001);
}

function getDevices(cb)
{
    var all = [];

    for (var device in devices) {
        all.push({
            id: device,
            name: Namer.getName(device),
            value: devices[device].value,
            state: devices[device].state,
            type: devices[device].type,
            subtype: devices[device].subtype,
            module: 'wemo'
        });
    }

    require('../common.js').addDeviceProperties(all);

    if (cb) cb(all);
}

function switchOn(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var self = this;

    devices[id].dev.setBinaryState(1, function(err) {

        if (err) {
            logger.error('switchOn', err);
            if (cb) cb(false);
            return;
        }

        self.log(id, Namer.getName(id), 'switch-on');

        conn.broadcast('switchState', { id: id, state: { on: true }});

        if (cb) cb(true);
    });
}

function switchOff(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var self = this;

    devices[id].dev.setBinaryState(0, function(err) {

        if (err) {
            logger.error('switchOff', err);
            if (cb) cb(false);
            return;
        }

        self.log(id, Namer.getName(id), 'switch-off');

        conn.broadcast('switchState', { id: id, state: { on: false }});

        if (cb) cb(true);
    });
}

function setDevicePowerState(id, on, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    if (devices[id].type === 'light') {

        setLightState.call(this, id, {on: on}, cb);

    } else {

        if (on) {
            switchOn.call(this, id, cb);
        } else {
            switchOff.call(this, id, cb);
        }
    }
}

function getDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var mycb = function (state) {
        if (cb) cb(state.on);
    };

    if (devices[id].type === 'light') {
        getLightState(id, mycb);
    } else {
        getSwitchState(id, mycb);
    }
}

function toggleDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
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
        if (cb) cb();
        return;
    }

    devices[id].dev.getBinaryState(function(err, result) {

        if (err) {
            logger.error('getSwitchState', err);
            if (cb) cb(null);
            return;
        }

        var state = parseInt(result, 10);

        var switchState = { on: state >= 1 };

        conn.broadcast('switchState', { id: id, state: switchState});

        if (cb) cb(switchState);
    });
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    devices[id].dev.getBinaryState(function(err, result) {

        if (err) {
            logger.error('getSwitchState', err);
            if (cb) cb(null);
            return;
        }

        var sensorValue = {
            id: id,
            name: Namer.getName(id),
            type: 'motion',
            value: result === '1'
        };

        conn.broadcast('sensorValue', sensorValue);

        if (cb) cb(sensorValue);
    });
}

function getLightState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    devices[id].dev.GetDeviceStatus(id, function(err, result) {

        if (err) {
            logger.error('getLightState', err);
            if (cb) cb(false);
            return;
        }

        var state = {
            on: result.on,
            hsl: [0, 0, result.level / 510],
            hex: '#ffffff'
        };

        devices[id].state = state;

        conn.broadcast('lightState', { id: id, state: state });

        if (cb) cb(state);
    });
}

function setLightState(id, values, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var capability = 10006;
    var value = values.on ? 1 : 0;

    devices[id].dev.SetDeviceStatus(id, capability, value, function(err) {

        if (err) {
            logger.error('setLightState', err);
            if (cb) cb(false);
            return;
        }

        getLightState(id);

        if (cb) cb(true);
    });
}

function setLightWhite(id, brightness, temperature, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb();
        return;
    }

    var capability = 10008;
    var value = (brightness / 100) * 255;

    devices[id].dev.SetDeviceStatus(id, capability, value, function(err) {

        if (err) {
            logger.error('setLightState', err);
            if (cb) cb(false);
            return;
        }

        getLightState(id);

        if (cb) cb(true);
    });
}

