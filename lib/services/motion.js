"use strict";

var fs = require('fs');
var MotionStream = require('motion').Stream;

var conn, logger;

var cfg = require('../configuration.js');

var streamcore;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Motion'});

    streamcore = require('../streaming/core.js');

    if (!streamcore.initialised) {
        streamcore(logger);
    }

    streamcore.ffmpeg(function(available) {

        if (!available) {
            logger.warn('Motion detection requires ffmpeg to be installed');
            return;
        }

        setTimeout(motionDetection, 3000);
    });
};

function motionDetection()
{
    var cameras = cfg.get('cameras', {});

    for (var cameraid in cameras) {
        if (cameras[cameraid].motion_recording || cameras[cameraid].motion_alarm) {
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

    var stopMotionRecording, stopMotionRecordingTimeout, motionStartTime, motionStartReal;

    var motionStart = function (frame) {

        var recordingid = require('node-uuid').v4();

        var recordings = cfg.get('recordings', {});

        recordings[recordingid] = {
            cameraid: cameraid,
            starttime: Date.now()
        };

        cfg.set('recordings', recordings);

        var filename = require('path').join(cfg.getVideoDirectory(), recordingid + '.webm');

        var destination = fs.createWriteStream(filename, 'binary');

        var options = {
            width: -1,
            height: -1,
            encoder: 'vp8',
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

                var recordings = cfg.get('recordings', {});

                recordings[recordingid].endtime = Date.now();
                recordings[recordingid].size = stat.size;

                cfg.set('recordings', recordings);

                motion.once('data', motionStart);
            });
        };

        stopMotionRecordingTimeout = setTimeout(stopMotionRecording, 5000);

        motionStartTime = frame.time;
        motionStartReal = Date.now();
    };

    var motionFrame = function (frame) {
        if (recorder) {
            setTimeout(function () {
                recorder.write(frame.data);
                clearTimeout(stopMotionRecordingTimeout);
                stopMotionRecordingTimeout = setTimeout(stopMotionRecording, 5000);
            }, (frame.time - motionStartTime) - (Date.now() - motionStartReal));
        }
    };

    var motionAlarm = function () {

        var motionDetected = {
            id: cameraid,
            name: camera.name,
            type: 'camera',
            value: true
        };

        conn.emit('alarmCheck', motionDetected);
    };

    if (camera.motion_recording) {
        motion.once('data', motionStart);
        motion.on('data', motionFrame);
    }

    if (camera.motion_alarm) {
        motion.on('data', motionAlarm);
    }

    streamcore.runStream(cameraid, camera, motionOptions, motion, id);
}

