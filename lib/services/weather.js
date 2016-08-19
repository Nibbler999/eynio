"use strict";

var conn;

var logger;

var get = require('simple-get');
var parseString = require('xml2js').parseString;
var SunCalc = require('suncalc');

var apiOptions = {
    hostname: 'api.met.no',
    port: 80,
    headers: {
        'User-agent' : 'NHome/1.0'
    }
};

var weather = {
    expires: 0,
    last_update: 0
};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Weather'});

    conn.on('getWeather', function (command) {
        getWeather.apply(command, command.args);
    });
};

function getWeather(cb)
{
    var cfg = require('../configuration.js');

    var latitude = cfg.get('latitude', null);
    var longitude = cfg.get('longitude', null);

    if (latitude !== null && longitude !== null) {

        // If response is still valid, return it
        if (weather.expires > Date.now()) {
            logger.debug('Returning previous response as not yet expired');
            if (typeof cb === 'function') {
                cb(weather);
            }
            return;
        }

        apiOptions.path = '/weatherapi/locationforecast/1.9/?lat=' + parseFloat(latitude).toFixed(2) + ';lon=' + parseFloat(longitude).toFixed(2);

        if (weather.last_update) {
            apiOptions.headers['If-Modified-Since'] = (new Date(weather.last_update)).toUTCString();
        }

        get.concat(apiOptions, function (err, res, data) {
            if (err) {
                logger.error('API error', err);
                if (typeof cb === 'function') {
                    cb(false);
                }
                return;
            }

            // Not modified
            if (res.statusCode === 304) {

                logger.debug('Returning previous response as not modified');

                weather.expires = +new Date(res.headers['expires']);

                if (typeof cb === 'function') {
                    cb(weather);
                }
                return;
            }

            logger.debug('Returning updated weather data');

            parseString(data, function (err, result) {

                if (err) {
                    logger.error('XML error', err);
                    if (typeof cb === 'function') {
                        cb(false);
                    }
                    return;
                }

                var now = Date.now();

                var times = SunCalc.getTimes(now, latitude, longitude);

                var is_night = now < times.sunrise || now > times.sunset;

                var current = result.weatherdata.product[0].time[0].location[0];
                var symbol = result.weatherdata.product[0].time[1].location[0].symbol[0].$.number;

                var icon = 'http://api.met.no/weatherapi/weathericon/1.1/?symbol=' + symbol + ';is_night=' + (is_night ? '1' : '0') + ';content_type=image/png';

                weather = {
                    temperature: parseFloat(current.temperature[0].$.value),
                    wind: {
                        direction: current.windDirection[0].$.name,
                        speed: parseFloat(current.windSpeed[0].$.mps)
                    },
                    humidity: parseFloat(current.humidity[0].$.value),
                    pressure: parseFloat(current.pressure[0].$.value),
                    cloudiness: parseFloat(current.cloudiness[0].$.percent),
                    last_update: +new Date(res.headers['last-modified']),
                    expires: +new Date(res.headers['expires']),
                    is_night: is_night,
                    icon: icon
                };

                if (typeof cb === 'function') {
                    cb(weather);
                }
            });
        });

    } else {
        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

