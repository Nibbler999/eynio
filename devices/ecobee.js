"use strict";

var Namer = require('../services/namer.js');
var Cats = require('../services/cats.js');
var cfg = require('../configuration.js');

var conn, thermostats = {}, sensors = {}, bridges = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'ecobee'});

    conn.send('getOAuth2Token', 'ecobee', function(token) {

        if (token && token.access_token) {
            loadDevices(startListening);
        }
    });
};

function loadDevices(cb)
{
    conn.send('getOAuth2Token', 'ecobee', function(token) {

        if (token && token.access_token) {

            var request = require('request');

            var headers = {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': 'Bearer ' + token.access_token
            };

            var selection = {selection: {
                selectionType: 'registered',
                selectionMatch: '',
                includeRuntime: true
            }};

            var url = 'https://api.ecobee.com/1/thermostat?json=' + JSON.stringify(selection);

            request.get(url, { headers: headers }, function (error, response, body) {

                if (!error && response.statusCode === 200) {

                    var result = JSON.parse(body);

                    thermostats = {};
                    sensors = {};

                    bridges.ecobee = true;

                    result.thermostatList.forEach(function (thermostat) {

                        var id = 'ecobee-' + thermostat.identifier;

                        thermostats[id] = {
                            id: id,
                            name: thermostat.name,
                            value: to_c(thermostat.runtime.actualTemperature),
                            target: 0
                        };

                        sensors[id + '-humidity'] = {
                            name: thermostat.name + ' humidity',
                            type: 'humidity',
                            value: thermostat.runtime.actualHumidity
                        };
                    });

                    Namer.add(thermostats);
                    Namer.add(sensors);
                }

                if (cb) cb();
            });

        } else {
            if (cb) cb();
        }
    });
}

// Temperature values are expressed as degrees Fahrenheit, multiplied by 10
function to_c(t)
{
    return parseFloat(((t / 10 - 32) * (5 / 9)).toFixed(1));
}

/*
function from_c(t)
{
    return Math.round(((t * (9 / 5)) + 32) * 10);
}
*/

function startListening()
{
    logger.info('Ready for commands');

    conn.on('getBridges', function (command) {
        getBridges.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });
}

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: 'ecobee',
            module: 'ecobee',
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
    loadDevices(function() {

        var blacklist = cfg.get('blacklist_devices', []);

        var all = [];

        for (var device in thermostats) {
            all.push({
                id: device,
                name: Namer.getName(device),
                value: thermostats[device].value,
                target: thermostats[device].target,
                categories: Cats.getCats(device),
                type: 'thermostat',
                blacklisted: blacklist.indexOf(device) !== -1
            });
        }

        for (device in sensors) {
            all.push({
                id: device,
                name: Namer.getName(device),
                value: sensors[device].value,
                categories: Cats.getCats(device),
                type: 'sensor',
                subtype: sensors[device].type,
                blacklisted: blacklist.indexOf(device) !== -1
            });
        }

        if (cb) cb(all);
    });
}

