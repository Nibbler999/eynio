"use strict";

var conn;

var logger;

var apiOptions = {
    hostname: 'api.yr.no',
    port: 80,
    headers: {
        'User-agent' : 'NHome/1.0',
        'Accept-Encoding': 'gzip'
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

        var http = require('http');
        var zlib = require('zlib');

        apiOptions.path = '/weatherapi/locationforecast/1.9/?lat=' + latitude + ';lon=' + longitude;

        if (weather.last_update) {
            apiOptions.headers['If-Modified-Since'] = (new Date(weather.last_update)).toUTCString(); 
        }

        http.get(apiOptions, function(apiRes) {

            // Not modified
            if (apiRes.statusCode === 304) {

                logger.debug('Returning previous response as not modified');

                weather.expires = +new Date(apiRes.headers['expires']);

                if (typeof cb === 'function') {
                    cb(weather);
                }
                return;
            }

            logger.debug('Returning updated weather data');

            var res = apiRes.pipe(zlib.createGunzip());

            var output = '';

            res.on('data', function (data) {
                output += data;
            });

            res.on('end', function() {

                var parseString = require('xml2js').parseString;

                parseString(output, function (err, result) {

                    if (err) {
                        logger.error('XML error', err);
                        if (typeof cb === 'function') {
                            cb(false);
                        }
                        return;
                    }

                    var SunCalc = require('iotdb-timers/node_modules/suncalc');

                    var now = Date.now();

                    var times = SunCalc.getTimes(now, latitude, longitude);

                    var is_night = now < times.sunrise || now > times.sunset;

                    var current = result.weatherdata.product[0].time[0].location[0];
                    var symbol = result.weatherdata.product[0].time[1].location[0].symbol[0].$.number;

                    var icon = 'http://api.yr.no/weatherapi/weathericon/1.1/?symbol=' + symbol + ';is_night=' + (is_night ? '1' : '0') + ';content_type=image/png';

                    weather = {
                        temperature: parseFloat(current.temperature[0].$.value),
                        wind: {
                            direction: current.windDirection[0].$.name,
                            speed: parseFloat(current.windSpeed[0].$.mps)
                        },
                        humidity: parseFloat(current.humidity[0].$.value),
                        pressure: parseFloat(current.pressure[0].$.value),
                        cloudiness: parseFloat(current.cloudiness[0].$.percent),
                        last_update: +new Date(apiRes.headers['last-modified']),
                        expires: +new Date(apiRes.headers['expires']),
                        is_night: is_night,
                        icon: icon
                    };

                    if (typeof cb === 'function') {
                        cb(weather);
                    }
                });
            });

        }).on('error', function(e) {
            logger.error('API error', e);
            if (typeof cb === 'function') {
                cb(false);
            }
        });

    } else {
        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

