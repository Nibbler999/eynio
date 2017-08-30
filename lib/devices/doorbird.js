"use strict";

var tcpp = require('tcp-ping');
var stream = require('stream');
var util = require('util');
var http = require('http');

var conn, logger;

var cfg = require('../configuration.js');

var streamcore = require('../streaming/core.js');

var subscriptions = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Doorbird'});

    startListening();
};

function startListening()
{
    conn.on('activateIntercomDoor', function (command) {
        activateIntercomDoor.apply(command, command.args);
    });

    conn.on('activateIntercomLight', function (command) {
        activateIntercomLight.apply(command, command.args);
    });

    conn.on('startStreaming', function (command) {
        startStreaming.apply(command, command.args);
    });

    conn.on('stopStreaming', function (command) {
        stopStreaming.apply(command, command.args);
    });

    conn.on('intercomAdded', function (intercom) {
        intercomAdded(intercom);
    });

    conn.on('intercomDeleted', function (id) {
        intercomDeleted(id);
    });

    var intercoms = cfg.get('intercoms', {});

    for (var id in intercoms) {
        if (intercoms[id].module === 'doorbird') {
            intercomAdded(intercoms[id]);
        }
    }
}

function activateIntercomDoor(deviceid, cb)
{
    var intercoms = cfg.get('intercoms', {});

    var intercom = intercoms[deviceid];

    if (intercom.module !== 'doorbird') {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var url = 'http://' + intercom.username + ':' + intercom.password + '@' + intercom.ip + '/bha-api/open-door.cgi';

    http.get(url, function (res) {

        res.resume();

        if (res.statusCode !== 200) {
            logger.error(intercom.ip, res.statusCode, res.statusMessage);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (typeof cb === 'function') {
            cb(true);
        }

    }).on('error', function (err) {
        logger.error(err);
    });
}

function activateIntercomLight(deviceid, cb)
{
    var intercoms = cfg.get('intercoms', {});

    var intercom = intercoms[deviceid];

    if (intercom.module !== 'doorbird') {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var url = 'http://' + intercom.username + ':' + intercom.password + '@' + intercom.ip + '/bha-api/light-on.cgi';

    http.get(url, function (res) {

        res.resume();

        if (res.statusCode !== 200) {
            logger.error(intercom.ip, res.statusCode, res.statusMessage);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (typeof cb === 'function') {
            cb(true);
        }

    }).on('error', function (err) {
        logger.error(err);
    });
}

function startStreaming(deviceid, options, cb)
{
    var intercoms = cfg.get('intercoms', {});

    var intercom = intercoms[deviceid];

    if (!intercom || intercom.module !== 'doorbird') {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    logger.debug('Creating stream from ' + deviceid);

    var destination = getSocketIOStream(deviceid, options);

    var key = cameraKey(deviceid, options);

    var url = 'http://' + intercom.ip + '/bha-api/video.cgi';

    tcpp.probe(intercom.ip, 80, function (err, available) {

        if (!available) {
            logger.error('Intercom', intercom.name, 'at', intercom.ip, 'is not available');
            logger.debug('Probe error', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var camera = {
            mjpeg: url,
            auth_name: intercom.username,
            auth_pass: intercom.password
        };

        streamcore.runStream(deviceid, camera, options, destination, key);

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function stopStreaming(deviceid, options)
{
    var key = cameraKey(deviceid, options);

    streamcore.stopStreaming(key);
}

function getSocketIOStream(cameraid, options)
{
    var Writable = stream.Writable;
    util.inherits(Streamer, Writable);

    function Streamer(opt) {
        Writable.call(this, opt);
    }

    Streamer.prototype._write = function(chunk, encoding, next) {

        if (!conn.connected) {
            return next();
        }

        var frame = {
            camera: cameraid,
            options: options,
            image: chunk
        };

        if (options.base64) {
            if (options.encoder === 'vp8-mse') {
                frame.image.metadata = frame.image.metadata.toString('base64');
                frame.image.cluster = frame.image.cluster.toString('base64');
            } else {
                frame.image = frame.image.toString('base64');
            }
        }

        if (options.local) {
            conn.local('cameraFrame', frame);
        } else if (['mpeg1', 'vp8', 'vp9'].indexOf(options.encoder) !== -1) {
            conn.send('cameraFrame', frame);
        } else {
            conn.sendVolatile('cameraFrame', frame);
        }

        next();
    };

    var writable = new Streamer({ objectMode: true });

    return writable;
}

function cameraKey(deviceid, options)
{
    return [
        deviceid,
        options.width,
        options.height,
        options.framerate,
        options.encoder || 'jpeg',
        options.base64 ? 'b64' : 'bin'
    ].join('-');
}

function intercomAdded(intercom)
{
    var server = http.createServer(function (req, res) {

        res.end();

        logger.info('Doorbell', intercom.name, 'activated');

        var event = {
            device_name: intercom.name,
            device_id: intercom.id,
            camera: true,
            datetime: Math.round(Date.now() / 1000)
        };

        conn.broadcast('intercomBellActivated', event, intercom);
    });

    var ip = require('ip').address();

    server.listen(0, ip, function () {

        var port = this.address().port;
        var callback = 'http://' + ip + ':' + port;
        var url = 'http://' + intercom.username + ':' + intercom.password + '@' + intercom.ip + '/bha-api/notification.cgi?url=' + callback + '&user=&password=&event=doorbell&subscribe=1';

        http.get(url, function (res) {

            res.resume();

            if (res.statusCode === 200) {

                subscriptions[intercom.id] = {
                    server: server,
                    url: url
                };

            } else {
                logger.error('Notification subscription', res.statusCode, res.statusMessage);
            }

        }).on('error', function (err) {
            logger.error('Notification subscription', err);
        });
    });
}

function intercomDeleted(id)
{
    var sub = subscriptions[id];

    if (!sub) {
        return false;
    }

    http.get(sub.url.replace('&subscribe=1', '&subscribe=0'), function (res) {

        res.resume();

        if (res.statusCode === 200) {

            sub.server.close();
            delete subscriptions[id];

        } else {
            logger.error('Notification unsubscription', res.statusCode, res.statusMessage);
        }

    }).on('error', function (err) {
        logger.error('Notification unsubscription', err);
    });
}

