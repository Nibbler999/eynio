"use strict";

var stream = require('stream');
var util = require('util');
var tcpp = require('tcp-ping');
var fs = require('fs');

var conn, logger, ffmpeg;

var sources = {}, destinations = {}, encoders = {}, pipes = {}, playbacks = {};

var snapshotCache = {};

var cfg = require('../configuration.js');

var ports_by_protocol = {
    'http:' : 80,
    'https:': 443,
    'rtsp:' : 554
};

var recordings = cfg.get('recordings', {});

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

    conn.on('getLiveThumbnail', function (command) {
        getLiveThumbnail.apply(command, command.args);
    });

    conn.on('getCachedThumbnail', function (command) {
        getCachedThumbnail.apply(command, command.args);
    });

    conn.on('testStreamURL', function (command) {
        testStreamURL.apply(command, command.args);
    });

    conn.on('startRecording', function (command) {
        startRecording.apply(command, command.args);
    });

    conn.on('stopRecording', function (command) {
        stopRecording.apply(command, command.args);
    });

    conn.on('getRecordings', function (command) {
        getRecordings.apply(command, command.args);
    });

    conn.on('deleteRecording', function (command) {
        deleteRecording.apply(command, command.args);
    });

    conn.on('startPlayback', function (command) {
        startPlayback.apply(command, command.args);
    });

    conn.on('endPlayback', function (command) {
        endPlayback.apply(command, command.args);
    });

    conn.on('disconnect', function () {
        stopStreamingAll();
    });

    ffmpeg.check(function() {
        updateCache();
        continuousRecordings();
    });

    setInterval(updateCache, 5 * 60 * 1000);
};

function updateCache()
{
    logger.debug('Updating camera thumbnails');

    var cameras = cfg.get('cameras', {});

    for (var cameraid in cameras) {
        updateCachedImage(cameraid);
    }
}

function updateCachedImage(id)
{
    getLiveThumbnail(id, function (image) {
        if (image) {
            logger.debug('Updated thumbnail for', id);
            snapshotCache[id] = image;
        }
    });
}

function continuousRecordings()
{
    logger.debug('Checking continuous recordings');

    var cameras = cfg.get('cameras', {});

    for (var cameraid in cameras) {
        if (cameras[cameraid].continuous_recording) {
            continuousRecord(cameraid);
        }
    }
}

function cleanSpace()
{
    var quota = cfg.get('recordingQuota', 0);

    if (!quota) {
        return;
    }

    quota *= 1024 * 1024;

    var list = hash_to_array(recordings);

    list = list.filter(function (recording) {
        return recording.endtime;
    }).sort(function (a, b) {
        return b.endtime - a.endtime;
    });

    var total = 0;

    list.forEach(function (recording) {
        total += recording.size;
        if (total > quota) {
            deleteRecording(recording.id);
        }
    });
}

function continuousRecord(cameraid)
{
    var record = function() {
        cleanSpace();
        startRecording(cameraid, function (recordingid) {
            if (!recordingid) {
                return;
            }
            setTimeout(function () {
                record();
                stopRecording(recordingid);
            }, 60 * 60 * 1000);
        });
    };

    record();
}

function startStreaming(cameraid, options, cb)
{
    logger.debug('Creating stream from ' + cameraid);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (camera.executable) {

        runStream(cameraid, camera, options);

        if (typeof cb === 'function') {
            cb(true);
        }

        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.probe(parts.hostname, port, function (err, available) {

        if (!available) {
            logger.error('Camera', camera.name, 'at', parts.hostname + ':' + port, 'is not available');
            logger.debug('Probe error', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        runStream(cameraid, camera, options);

        if (typeof cb === 'function') {
            cb(true);
        }
    });
}

function runStream(cameraid, camera, options)
{
    var pipeSource = function (source) {

        var key = cameraKey(cameraid, options);

        var sio = destinations[key] = getSocketIOStream(cameraid, options);

        sio.on('pipe', function () {
            if (!pipes[cameraid]) {
                pipes[cameraid] = 0;
            }
            pipes[cameraid]++;
        });

        sio.on('unpipe', function () {
            if (--pipes[cameraid] === 0) {
                sources[cameraid][options.framerate].end();
            }
        });

        if (ffmpeg.available && (options.width > 0 || options.height > 0 || camera.rotate || options.encoder)) {

            encoders[key] = ffmpeg.getEncoder(options, camera.rotate);

            source = source.pipe(encoders[key]);
        }

        source.pipe(sio);
    };

    if (sources[cameraid] && sources[cameraid][options.framerate] && sources[cameraid][options.framerate].readable) {
        pipeSource(sources[cameraid][options.framerate]);
    } else {

        getSourceStream(camera, options, function (source) {

            if (!source) {
                return false;
            }

            source.setMaxListeners(100);

            if (!sources[cameraid]) {
                sources[cameraid] = {};
            }

            sources[cameraid][options.framerate] = source;

            pipeSource(source);
        });
    }
}

function stopStreaming(cameraid, options)
{
    var key = cameraKey(cameraid, options);

    if (encoders[key]) {
        encoders[key].unpipe(destinations[key]);
        sources[cameraid][options.framerate].unpipe(encoders[key]);
    } else if (sources[cameraid] && sources[cameraid][options.framerate]) {
        sources[cameraid][options.framerate].unpipe(destinations[key]);
    }
}

function stopStreamingAll()
{
    for (var d in destinations) {
        if (d.indexOf('remote') !== -1) {
            destinations[d].end();
        }
    }
}

function getSourceStream(camera, options, cb)
{
    var method;

    if (camera.mjpeg) {
        method = require('./streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('./streaming/rtsp.js');
    } else if (camera.executable) {
        method = require('./streaming/executable.js');
    } else if (camera.snapshot) {
        method = require('./streaming/snapshot.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    method.stream(logger, camera, options, cb);
}

function getLiveThumbnail(cameraid, cb)
{
    logger.debug('Creating snapshot from ' + cameraid);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (camera.executable) {
        getThumbnail(cameraid, cb);
        return;
    }

    var parts = require('url').parse(camera.snapshot || camera.mjpeg || camera.rtsp);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.ping({address: parts.hostname, port: port, attempts: 1, timeout: 2000 }, function (err, data) {

        if (data.min === undefined) {
            logger.debug('Camera', camera.name, 'at', parts.hostname + ':' + port, 'not responding to tcp connection');
            logger.debug('Probe error', err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        getThumbnail(cameraid, cb);
    });
}

function saveImageDimensions(camera, image)
{
    var size = require('jpeg-size');

    var s = size(image);

    if (s) {

        if (camera.width !== s.width || camera.height !== s.height) {
            s.id = camera.id;
            conn.emit('updateCamera', {args: [s]});
        }
    }
}

function getThumbnail(id, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[id];

    if (!camera) {
        return false;
    }

    getThumbnailImage(id, function (image) {

        if (!image) {
            return false;
        }

        saveImageDimensions(camera, image);

        var options = {
            width: -1,
            height: 120
        };

        if (ffmpeg.available && (options.width > 0 || options.height > 0 || camera.rotate)) {

            var scaler = ffmpeg.getEncoder(options, camera.rotate);

            scaler.once('data', function (thumbnail) {
                cb(thumbnail);
            });

            scaler.write(image);
            scaler.end();

        } else {
            cb(image);
        }
    });
}

function getThumbnailImage(id, cb)
{
    var method;

    var cameras = cfg.get('cameras', {});

    var camera = cameras[id];

    if (!camera) {
        logger.debug('Unknown camera', id);
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (camera.snapshot) {
        method = require('./streaming/snapshot.js');
    } else if (camera.mjpeg) {
        method = require('./streaming/mjpeg.js');
    } else if (camera.rtsp && ffmpeg.available) {
        method = require('./streaming/rtsp.js');
    } else if (camera.executable) {
        method = require('./streaming/executable.js');
    } else {
        logger.error('No valid source found for camera', camera.name);
        cb(false);
    }

    method.snapshot(logger, camera, cb);
}

function getCachedThumbnail(cameraid, cb)
{
    logger.debug('Retrieving cached snapshot from ' + cameraid);

    if (snapshotCache[cameraid]) {
        cb(snapshotCache[cameraid]);
    } else {
        getLiveThumbnail(cameraid, function (image) {
            if (image) {
                snapshotCache[cameraid] = image;
            }
            cb(image);
        });
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
            conn.local('cameraFrame', frame);
        } else {
            conn.broadcast('cameraFrame', frame);
        }

        next();
    };

    var writable = new Streamer();

    return writable;
}

function getSocketIOStreamRecording(playbackid, options)
{
    var Writable = stream.Writable;
    util.inherits(Streamer, Writable);

    function Streamer(opt) {
        Writable.call(this, opt);
    }

    Streamer.prototype._write = function(chunk, encoding, next) {

        var frame = {
            playbackid: playbackid,
            options: options,
            image: chunk
        };

        if (options.local) {
            conn.local('recordingFrame', frame);
        } else {
            conn.broadcast('recordingFrame', frame);
        }

        next();
    };

    var writable = new Streamer();

    return writable;
}

function testStreamURL(url, cb)
{
    var parts = require('url').parse(url);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.ping({address: parts.hostname, port: port, attempts: 1, timeout: 2000 }, function (err, data) {

        if (err) {
            logger.debug(err);
        }

        if (typeof cb === 'function') {
            cb(data.min !== undefined);
        }
    });
}

function cameraKey(cameraid, options)
{
    return [cameraid, options.width, options.height, options.framerate, options.encoder || 'jpeg', options.local ? 'local' : 'remote'].join('-');
}

var recordingOptions = {
    width: -1,
    height: -1,
    framerate: 25,
    encoder: 'vp8'
};

function startRecording(cameraid, cb)
{
    if (!ffmpeg.available) {
        cb(false);
        return false;
    }

    var recordingid = require('node-uuid').v4();

    recordings[recordingid] = {
        cameraid: cameraid,
        starttime: Date.now()
    };

    cfg.set('recordings', recordings);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    var pipeSource = function (source) {

        encoders[recordingid] = ffmpeg.getEncoder(recordingOptions, camera.rotate);

        source = source.pipe(encoders[recordingid]);

        var filename = require('path').join(getVideoDirectory(), recordingid + '.webm');

        var disk = destinations[recordingid] = fs.createWriteStream(filename, 'binary');

        disk.on('pipe', function () {
            if (!pipes[cameraid]) {
                pipes[cameraid] = 0;
            }
            pipes[cameraid]++;
        });

        disk.on('unpipe', function () {
            if (--pipes[cameraid] === 0) {
                sources[cameraid][recordingOptions.framerate].end();
            }
        });

        source.pipe(disk);

        cb(recordingid);
    };

    if (sources[cameraid] && sources[cameraid][recordingOptions.framerate] && sources[cameraid][recordingOptions.framerate].readable) {
        pipeSource(sources[cameraid][recordingOptions.framerate]);
    } else {

        getSourceStream(camera, recordingOptions, function (source) {

            if (!source) {
                return false;
            }

            source.setMaxListeners(100);

            if (!sources[cameraid]) {
                sources[cameraid] = {};
            }

            sources[cameraid][recordingOptions.framerate] = source;

            pipeSource(source);
        });
    }
}

function stopRecording(recordingid, cb)
{
    var cameraid = recordings[recordingid].cameraid;

    if (encoders[recordingid]) {

        encoders[recordingid].unpipe(destinations[recordingid]);
        sources[cameraid][recordingOptions.framerate].unpipe(encoders[recordingid]);

        var filename = require('path').join(getVideoDirectory(), recordingid + '.webm');

        fs.stat(filename, function (err, stat) {

            if (err) {
                logger.error(err);
                return;
            }

            recordings[recordingid].endtime = Date.now();
            recordings[recordingid].size = stat.size;

            cfg.set('recordings', recordings);
        });

        if (typeof cb === 'function') {
            cb(true);
        }

    } else {
        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

function startPlayback(recordingid, playbackid, options)
{
    var filename = require('path').join(getVideoDirectory(), recordingid + '.webm');

    var source;

    if (options.encoder === 'vp8') {
        source = fs.createReadStream(filename);
    } else {
        source = playbacks[playbackid] = ffmpeg.playRecording(filename, options);
    }

    source.once('end', function () {
        conn.broadcast('playbackEnded', playbackid);
    });

    var sio = getSocketIOStreamRecording(playbackid, options);

    source.pipe(sio);
}

function endPlayback(playbackid)
{
    if (playbacks[playbackid]) {
        playbacks[playbackid].stop();
    }
}

function getVideoDirectory()
{
    var home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

    var dirname = 'nhome-videos';

    if (require('os').type() === 'Linux') {
        dirname = '.' + dirname;
    }

    var fullpath = require('path').join(home, dirname);

    try {
        fs.accessSync(fullpath, fs.R_OK | fs.W_OK);
    } catch (e) {
        fs.mkdirSync(fullpath);
    }

    return fullpath;
}

function getRecordings(cb)
{
    cb(hash_to_array(recordings));
}

function deleteRecording(recordingid, cb)
{
    if (!recordings.hasOwnProperty(recordingid)) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    delete recordings[recordingid];

    cfg.set('recordings', recordings);

    if (/^[a-f0-9-]+$/.test(recordingid)) {
        var filename = require('path').join(getVideoDirectory(), recordingid + '.webm');
        fs.unlink(filename);
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function hash_to_array(hash)
{
    var array = [], object;

    for (var key in hash) {

        object = {
            id: key
        };

        for (var key2 in hash[key]) {
            object[key2] = hash[key][key2];
        }

        array.push(object);
    }

    return array;
}

