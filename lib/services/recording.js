"use strict";

var stream = require('stream');
var util = require('util');
var fs = require('fs');
var MotionStream = require('motion').Stream;

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

        if (!available) {
            logger.error('Camera recording requires ffmpeg to be installed');
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

        setTimeout(motionDetection, 1000);
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

    var filename = require('path').join(getVideoDirectory(), recordingid + '.webm');

    var destination = fs.createWriteStream(filename, 'binary');

    streamcore.runStream(cameraid, camera, recordingOptions, destination, recordingid);

    cb(recordingid);
}

function stopRecording(recordingid, cb)
{
    var cameraid = recordings[recordingid].cameraid;

    streamcore.stopStreaming(cameraid, recordingOptions, recordingid);

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
}

function startPlayback(recordingid, playbackid, options)
{
    var filename = require('path').join(getVideoDirectory(), recordingid + '.webm');

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

function motionDetection()
{
    var cameras = cfg.get('cameras', {});

    for (var cameraid in cameras) {
        if (cameras[cameraid].motion_recording || cameraid === 'ex') {
            startMotionDetection(cameraid);
        }
    }
}

var motionOptions = {
    width: -1,
    height: -1,
    framerate: 10,
    encoder: 'jpeg'
};

function startMotionDetection(cameraid)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    var id = 'motion-' + cameraid;

    var motion = new MotionStream({ resolution: [camera.width, camera.height] });

    var recorder;

    var stopMotionRecording, stopMotionRecordingTimeout, motionStartTime;

    var motionStart = function (frame) {

        var recordingid = require('node-uuid').v4();

        recordings[recordingid] = {
            cameraid: cameraid,
            starttime: Date.now()
        };

        cfg.set('recordings', recordings);

        var filename = require('path').join(getVideoDirectory(), recordingid + '.webm');

        var destination = fs.createWriteStream(filename, 'binary');

        var options = {
            width: -1,
            height: -1,
            encoder: 'vp8-motion',
            framerate: motionOptions.framerate
        };

        recorder = streamcore.getEncoder(options);

        recorder.pipe(destination);

        stopMotionRecording = function () {

            recorder.end();
            recorder = null;

            fs.stat(filename, function (err, stat) {

                if (err) {
                    logger.error(err);
                    return;
                }

                recordings[recordingid].endtime = Date.now();
                recordings[recordingid].size = stat.size;

                cfg.set('recordings', recordings);

                motion.once('data', motionStart);
            });
        };

        stopMotionRecordingTimeout = setTimeout(stopMotionRecording, 5000);

        motionStartTime = frame.time;
    };

    var motionFrame = function (frame) {
        if (recorder) {
            setTimeout(function () {
                recorder.write(frame.data);
                clearTimeout(stopMotionRecordingTimeout);
                stopMotionRecordingTimeout = setTimeout(stopMotionRecording, 5000);
            }, frame.time - motionStartTime);
        }
    };

    motion.once('data', motionStart);
    motion.on('data', motionFrame);

    streamcore.runStream(cameraid, camera, motionOptions, motion, id);
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

