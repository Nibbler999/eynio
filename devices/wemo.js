"use strict";

var WeMo = require('wemo');

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {}, subscriptions = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'WeMo'});

    var client = WeMo.Search();

    client.on('found', function(device) {

        devices[device.serialNumber] = {
            name: device.friendlyName,
            type: device.deviceType === 'urn:Belkin:device:sensor:1' ? 'sensor' : 'switch',
            subtype: device.type === 'sensor' ? 'motion' : '',
            value: device.binaryState === '1',
            dev: new WeMo(device.ip, device.port)
        };

        Namer.add(devices);

        subscribe(device);
    });

    client.once('found', function() {
        startListening();
        startUPnPServer();
    });
};

function startListening()
{
    logger.info('Ready for commands');

    conn.on('getDevices', function (cb) {
        getDevices(cb);
    });

    conn.on('switchOn', function (id) {
        switchOn(id);
    });

    conn.on('switchOff', function (id) {
        switchOff(id);
    });

    conn.on('getSwitches', function (cb) {
        getSwitches(cb);
    });

    conn.on('getSwitchState', function (id, cb) {
        getSwitchState(id, cb);
    });

    conn.on('getSensors', function (cb) {
        getSensors(cb);
    });

    conn.on('getSensorValue', function (id, cb) {
        getSensorValue(id, cb);
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

                        var value  = parseInt(property[p][0], 10);
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
            type: devices[device].type,
            subtype: devices[device].subtype,
            categories: Cats.getCats(device)
        });
    }

    if (cb) cb(all);
}

function getSwitches(cb)
{
    var switches = [];

    for (var device in devices) {
        if (devices[device].type === 'switch') {
            switches.push({
                id: device,
                name: Namer.getName(device),
                value: devices[device].value,
                categories: Cats.getCats(device)
            });
        }
    }

    conn.broadcast('switches', switches);

    if (cb) cb(switches);
}

function switchOn(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setBinaryState(1, function(err, result) {

        if (err) {
            logger.error('switchOn', err);
            return;
        }
    });
}

function switchOff(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setBinaryState(0, function(err, result) {

        if (err) {
            logger.error('switchOff',  err);
            return;
        }
    });
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
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

function getSensors(cb)
{
    var sensors = [];

    for (var device in devices) {
        if (devices[device].type === 'sensor') {
            sensors.push({
                id: device,
                name: Namer.getName(device),
                value: devices[device].value,
                type: 'motion',
                categories: Cats.getCats(device)
            });
        }
    }

    conn.broadcast('sensors', sensors);

    if (cb) cb(sensors);
}

function getSensorValue(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (cb) cb([]);
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

