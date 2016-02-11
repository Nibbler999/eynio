"use strict";

var fs = require('fs');
var stream = require('readable-stream');

var MotionStream = require('../streaming/motionstream');

var conn, logger;

var cfg = require('../configuration.js');

var streamcore;

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

    streamcore = require('../streaming/core.js');

    if (!streamcore.initialised) {
        streamcore(logger);
    }

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
            streamcore.stopStreaming(cameraid, motionOptions, id);
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

    var stopMotionRecording, stopMotionRecordingTimeout, motionStartTime, motionStartReal;

    var recordingInProgress = false;
    var readyToRecord = true;

    var recordingStream = motionRecorders[cameraid] = new stream.Writable({
        objectMode: true,
        write: function(frame, encoding, next) {

            if (recordingInProgress) {

                setTimeout(function () {
                    recorder.write(frame.data);
                    clearTimeout(stopMotionRecordingTimeout);
                    stopMotionRecordingTimeout = setTimeout(stopMotionRecording, 5000);
                }, (frame.time - motionStartTime) - (Date.now() - motionStartReal));

            } else if (readyToRecord) {

                recordingInProgress = true;

                var recordingid = require('node-uuid').v4();

                var recordings = cfg.get('recordings', {});

                recordings[recordingid] = {
                    cameraid: cameraid,
                    starttime: Date.now()
                };

                cfg.set('recordings', recordings);

                var rec = {
                    id: recordingid,
                    cameraid: recordings[recordingid].cameraid,
                    starttime: recordings[recordingid].starttime
                };

                conn.broadcast('recordingAdded', rec);

                var dir = cfg.getVideoDirectory();

                var filename = require('path').join(dir, recordingid + '.webm');
                var thumbnail = require('path').join(dir, recordingid + '.jpeg');

                var destination = fs.createWriteStream(filename, 'binary');

                streamcore.makeThumbnail(frame.data, camera, function (image) {
                    fs.writeFile(thumbnail, image);
                });

                var options = {
                    width: -1,
                    height: -1,
                    encoder: 'vp8',
                    framerate: motionOptions.framerate
                };

                recorder = streamcore.getEncoder(options);

                recorder.pipe(destination);

                stopMotionRecording = function () {

                    recordingInProgress = false;

                    recorder.on('finish', function () {

                        streamcore.finalize(filename, function () {

                            fs.stat(filename, function (err, stat) {

                                if (err) {
                                    logger.error(err);
                                    return;
                                }

                                var recordings = cfg.get('recordings', {});

                                recordings[recordingid].endtime = Date.now();
                                recordings[recordingid].size = stat.size;

                                cfg.set('recordings', recordings);

                                readyToRecord = true;
                            });
                        });
                    });

                    recorder.end();
                };

                stopMotionRecordingTimeout = setTimeout(stopMotionRecording, 5000);

                motionStartTime = frame.time;
                motionStartReal = Date.now();
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
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

