"use strict";

var stream = require('stream');
var util = require('util');
var fs = require('fs');

var conn, logger;

var playbacks = {};

var cfg = require('../configuration.js');

var streamcore;

var recordings = cfg.get('recordings', {});

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Recording'});

    streamcore = require('../streaming/core.js');

    if (!streamcore.initialised) {
        streamcore(logger);
    }

    streamcore.ffmpeg(function(available) {

        conn.on('getRecordings', function (command) {
            getRecordings.apply(command, command.args);
        });

        conn.on('deleteRecording', function (command) {
            deleteRecording.apply(command, command.args);
        });

        conn.on('getRecordingThumbnail', function (command) {
            getRecordingThumbnail.apply(command, command.args);
        });

        if (!available) {
            logger.warn('Camera recording requires ffmpeg to be installed');
            return;
        }

        conn.on('startRecording', function (command) {
            startRecording.apply(command, command.args);
        });

        conn.on('stopRecording', function (command) {
            stopRecording.apply(command, command.args);
        });

        conn.on('startPlayback', function (command) {
            startPlayback.apply(command, command.args);
        });

        conn.on('endPlayback', function (command) {
            endPlayback.apply(command, command.args);
        });

        continuousRecordings();
    });
};

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

function getSocketIOStream(playbackid, options)
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

var recordingOptions = {
    width: -1,
    height: -1,
    framerate: 10,
    encoder: 'vp8'
};

function startRecording(cameraid, cb)
{
    var recordingid = require('node-uuid').v4();

    recordings[recordingid] = {
        cameraid: cameraid,
        starttime: Date.now()
    };

    cfg.set('recordings', recordings);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    var dir = cfg.getVideoDirectory();

    var filename = require('path').join(dir, recordingid + '.webm');
    var thumbnail = require('path').join(dir, recordingid + '.jpeg');

    var destination = fs.createWriteStream(filename, 'binary');

    streamcore.runStream(cameraid, camera, recordingOptions, destination, recordingid, thumbnail);

    cb(recordingid);
}

function stopRecording(recordingid, cb)
{
    var cameraid = recordings[recordingid].cameraid;

    streamcore.stopStreaming(cameraid, recordingOptions, recordingid);

    var filename = require('path').join(cfg.getVideoDirectory(), recordingid + '.webm');

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
}

function startPlayback(recordingid, playbackid, options)
{
    var filename = require('path').join(cfg.getVideoDirectory(), recordingid + '.webm');

    var source;

    if (options.encoder === 'vp8') {
        source = fs.createReadStream(filename);
    } else {
        source = playbacks[playbackid] = streamcore.playRecording(filename, options);
    }

    source.once('end', function () {
        conn.broadcast('playbackEnded', playbackid);
    });

    var sio = getSocketIOStream(playbackid, options);

    source.pipe(sio);
}

function endPlayback(playbackid)
{
    if (playbacks[playbackid]) {
        playbacks[playbackid].stop();
    }
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

        var dir = cfg.getVideoDirectory();

        var filename = require('path').join(dir, recordingid + '.webm');
        var thumbnail = require('path').join(dir, recordingid + '.jpeg');

        try {
            fs.unlink(filename);
        } catch (err) {
            logger.warn('Failed to delete recording at ' + filename, err);
        }

        try {
            fs.unlink(thumbnail);
        } catch (err) {
            logger.warn('Failed to delete thumbnail at ' + thumbnail, err);
        }
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function getRecordingThumbnail(recordingid, cb)
{
    var dir = cfg.getVideoDirectory();

    var thumbnail = require('path').join(dir, recordingid + '.jpeg');

    fs.readFile(thumbnail, function (err, data) {

        if (err) {

            logger.error(err);

            if (typeof cb === 'function') {
                cb(false);
            }

            return false;
        }

        if (typeof cb === 'function') {
            cb(data);
        }
    });
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

