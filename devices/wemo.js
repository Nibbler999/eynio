"use strict";

var WeMo = require('wemo');

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');

var conn, devices = {}, subscriptions = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'WeMo'});

    conn.once('accepted', function (cfg) {

        var client = WeMo.Search();

        client.on('found', function(device) {

            devices[device.serialNumber] = {
                name: device.friendlyName,
                type: device.modelName === 'Sensor' ? 'sensor' : 'switch',
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
    });
};

function startListening()
{
    log('Ready for commands');

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
            'CALLBACK': '<http://' + ipaddress +':3001/>',
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
		        }
		
		        var property = json['e:propertyset']['e:property'][0];
		        
		        for (var p in property) {
		        
		            if (p === 'BinaryState') {

		                var value  = property[p][0];
		                var device = devices[id];
		                
		                device.value = (value === '1');
		                
		                if (device.type === 'switch') {

                            var switchState = { on: device.value };

                            conn.emit('switchState', { id: id, state: switchState});
                            
		                } else if (device.type === 'sensor') {
		                
		                    var sensorValue = {
                                id: id,
                                name: Namer.getName(id),
                                type: 'motion',
                                value: device.value
                            };
                            
                            conn.emit('sensorValue', sensorValue);
                        }
		            }
		        }
		    });
		    
		    res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('OK\n');
		});
		
    }).listen(3001);
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

    conn.emit('switches', switches);

    if (cb) cb(switches);
}

function switchOn(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    devices[id].dev.setBinaryState(1, function(err, result) {

        if (err) {
            log('switchOn:' + err);
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
            log('switchOff:' + err);
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
            log('getSwitchState:' + err);
            if (cb) cb(null);
            return;
        }

        var switchState = { on: result === '1'};

        conn.emit('switchState', { id: id, state: switchState});

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

    conn.emit('sensors', sensors);

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
            log('getSwitchState:' + err);
            if (cb) cb(null);
            return;
        }

        var sensorValue = {
            id: id,
            name: Namer.getName(id),
            type: 'motion',
            value: result === '1'
        };

        conn.emit('sensorValue', sensorValue);
    
        if (cb) cb(sensorValue);
    });
}

