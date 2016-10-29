"use strict";

var stream = require('readable-stream');

var MotionStream = require('../streaming/motionstream');
var MotionRecorder = require('../streaming/motionrecorder');

var conn, logger;

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var streamcore = require('../streaming/core.js');

var motionDetectors = {}, motionRecorders = {}, motionAlerters = {}, pipes = {};

var motionOptions = {
    width: -1,
    height: -1,
    framerate: 10,
    encoder: 'jpeg'
};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Motion'});

    streamcore.ffmpeg(function(available) {

        if (!available) {
            logger.warn('Motion detection requires ffmpeg to be installed');
            return;
        }

        conn.on('enableMotionRecording', function (command) {
            enableMotionRecording.apply(command, command.args);
        });

        conn.on('disableMotionRecording', function (command) {
            disableMotionRecording.apply(command, command.args);
        });

        conn.on('enableMotionAlarms', function (command) {
            enableMotionAlarms.apply(command, command.args);
        });

        conn.on('disableMotionAlarms', function (command) {
            disableMotionAlarms.apply(command, command.args);
        });

        setTimeout(motionDetection, 3000);
    });
};

function motionDetection()
{
    var cameras = cfg.get('cameras', {});

    for (var cameraid in cameras) {
        if (cameras[cameraid].motion_recording) {
            enableMotionRecording(cameraid);
        }
        if (cameras[cameraid].motion_alarm) {
            enableMotionAlarms(cameraid);
        }
    }
}

function pipeMotionDetector(cameraid, destination)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    var id = 'motion-' + cameraid;

    if (!motionDetectors[cameraid]) {
        motionDetectors[cameraid] = new MotionStream({ resolution: [camera.width, camera.height] });
        motionDetectors[cameraid].resume(); // Node 0.10
        streamcore.runStream(cameraid, camera, motionOptions, motionDetectors[cameraid], id);
    }

    destination.on('pipe', function () {
        if (!pipes[cameraid]) {
            pipes[cameraid] = 0;
        }
        pipes[cameraid]++;
    });

    destination.on('unpipe', function () {
        if (--pipes[cameraid] === 0) {
            streamcore.stopStreaming(id);
            delete motionDetectors[cameraid];
        }
    });

    motionDetectors[cameraid].pipe(destination);
}

function enableMotionRecording(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera.motion_recording) {
        camera.motion_recording = true;
        cfg.set('cameras', cameras);
    }

    var recorder;

    var recordingStream = motionRecorders[cameraid] = new stream.Writable({
        objectMode: true,
        write: function (frame, encoding, next) {

            if (!recorder) {

                if (camera.motion_recording_if_alarm) {

                    var alarm_simple = cfg.get('alarm_simple', { enabled: false  });

                    if (!alarm_simple.enabled) {
                        next();
                        return;
                    }
                }

                cleanSpace();

                var recordingid = require('node-uuid').v4();

                var recordings = cfg.recordings.get('recordings', {});

                recordings[recordingid] = {
                    cameraid: cameraid,
                    starttime: Date.now()
                };

                cfg.recordings.set('recordings', recordings);

                var rec = {
                    id: recordingid,
                    cameraid: recordings[recordingid].cameraid,
                    starttime: recordings[recordingid].starttime
                };

                conn.broadcast('recordingAdded', rec);

                recorder = new MotionRecorder(recordingid, camera);
            }

            recorder.write(frame);

            if (frame.isLastFrame) {
                recorder = null;
            }

            next();
        }
    });

    pipeMotionDetector(cameraid, recordingStream);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function disableMotionRecording(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (camera.motion_recording) {
        camera.motion_recording = false;
        cfg.set('cameras', cameras);
    }

    if (motionDetectors[cameraid] && motionRecorders[cameraid]) {
        motionDetectors[cameraid].unpipe(motionRecorders[cameraid]);
        delete motionRecorders[cameraid];
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function enableMotionAlarms(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera.motion_alarm) {
        camera.motion_alarm = true;
        cfg.set('cameras', cameras);
    }

    var alerter = motionAlerters[cameraid] = new stream.Writable({
        objectMode: true,
        write: function(chunk, encoding, next) {

            var motionDetected = {
                id: cameraid,
                name: camera.name,
                type: 'camera',
                value: true
            };

            conn.emit('alarmCheck', motionDetected);

            next();
        }
    });

    pipeMotionDetector(cameraid, alerter);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function disableMotionAlarms(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (camera.motion_alarm) {
        camera.motion_alarm = false;
        cfg.set('cameras', cameras);
    }

    if (motionDetectors[cameraid] && motionAlerters[cameraid]) {
        motionDetectors[cameraid].unpipe(motionAlerters[cameraid]);
        delete motionAlerters[cameraid];
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function cleanSpace()
{
    var quota = cfg.get('recordingQuota', 100);

    if (!quota) {
        return;
    }

    quota *= 1024 * 1024;

    var recordings = cfg.recordings.get('recordings', {});

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
            conn.emit('deleteRecording', { args: [recording.id] });
        }
    });
}

