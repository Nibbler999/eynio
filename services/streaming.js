"use strict";

var stream = require('stream');
var util = require('util');
var tcpp = require('tcp-ping');

var conn, logger, ffmpeg;

var sources = {}, destinations = {}, scalers = {}, pipes = {};

var ports_by_protocol = {
    'http:' : 80,
    'https:': 443,
    'rtsp:' : 514
};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    ffmpeg = require('./streaming/ffmpeg.js')(logger);

    conn.on('startStreaming', function (command) {
        startStreaming.apply(command, command.args);
    });

    conn.on('stopStreaming', function (command) {
        stopStreaming.apply(command, command.args);
    });

    ffmpeg.check();
};

function startStreaming(cameraid, options, cb)
{
    logger.debug('Creating stream from ' + cameraid);

    var cfg = require('../configuration.js');
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.error('Unknown camera', cameraid);
        logger.debug('Known cameras', cameras);
        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.probe(parts.hostname, port, function (err, available) {

        if (!available) {
            logger.error('Camera at', parts.hostname + ':' + port, 'is not available');
            logger.debug('Probe error', err);
            if (cb) cb(false);
            return;
        }

        runStream(cameraid, camera, options);

        if (cb) cb(true);
    });
}

function runStream(cameraid, camera, options)
{
    var pipeSource = function (source) {

        var key = cameraKey(cameraid, options);

        var sio = destinations[key] = getSocketIOStream(cameraid, options);

        sio.on('pipe', function () {
            if (!pipes[cameraid]) pipes[cameraid] = 0;
            pipes[cameraid]++;
        });

        sio.on('unpipe', function () {
            if (--pipes[cameraid] === 0) {
                sources[cameraid].end();
            }
        });

        if (ffmpeg.available && (options.width > 0 || options.height > 0)) {

            var scaler = scalers[key] = ffmpeg.getScaler(options);

            source.pipe(scaler).pipe(sio);

        } else {
            source.pipe(sio);
        }
    };

    if (sources[cameraid] && sources[cameraid].readable) {
        pipeSource(sources[cameraid]);
    } else {

        getSourceStream(camera, options, function (source) {
            sources[cameraid] = source;
            pipeSource(source);
        });
    }
}

function stopStreaming(cameraid, options)
{
    var key = cameraKey(cameraid, options);

    if (scalers[key]) {
        scalers[key].unpipe(destinations[key]);
        sources[cameraid].unpipe(scalers[key]);
    } else if (sources[cameraid]) {
        sources[cameraid].unpipe(destinations[key]);
    }
}

function getSourceStream(camera, options, cb)
{
    if (camera.snapshot) {
        require('./streaming/snapshot.js')(logger, camera, options, cb);
    } else if (camera.mjpeg) {
        require('./streaming/mjpeg.js')(logger, camera, options, cb);
    } else if (camera.rtsp) {
        require('./streaming/rtsp.js')(logger, camera, options, cb);
    }
}

function getSocketIOStream(cameraid, options)
{
    var Writable = stream.Writable;
    util.inherits(Streamer, Writable);

    function Streamer(opt) {
        Writable.call(this, opt);
    }

    Streamer.prototype._write = function(chunk, encoding, next) {

        var frame = {
            camera: cameraid,
            options: options,
            image: chunk
        };

        if (options.local) {
            conn.compress(false).local('cameraFrame', frame);
        } else {
            conn.compress(false).broadcast('cameraFrame', frame);
        }

        next();
    };

    var writable = new Streamer();

    return writable;
}

function cameraKey(cameraid, options)
{
    return [cameraid, options.width, options.height, options.framerate, options.local ? 'local' : 'remote'].join('-');
}

