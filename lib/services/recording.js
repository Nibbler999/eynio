"use strict";

var stream = require('stream');
var util = require('util');
var fs = require('fs');
var series = require('async/series');
var tcpp = require('tcp-ping');

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var streamcore = require('../streaming/core.js');

var conn, logger, dir;

var playbacks = {}, rtsp_procs = {}, recordingTimeouts = {}, continuous_recordings = {};

var recordings;

var ports_by_protocol = {
    'http:' : 80,
    'https:': 443,
    'rtsp:' : 554
};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Recording'});

    var oldrecordings = cfg.get('recordings');

    if (oldrecordings) {
        cfg.recordings.set('recordings', oldrecordings);
        cfg.delete('recordings');
    }

    recordings = cfg.recordings.get('recordings', {});

    dir = cfg.getVideoDirectory();

    streamcore.ffmpeg(function(available) {

        conn.on('getRecordings', function (command) {
            getRecordings.apply(command, command.args);
        });

        conn.on('getSomeRecordings', function (command) {
            getSomeRecordings.apply(command, command.args);
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

        conn.on('enableContinuousRecording', function (command) {
            enableContinuousRecording.apply(command, command.args);
        });

        conn.on('disableContinuousRecording', function (command) {
            disableContinuousRecording.apply(command, command.args);
        });

        finaliseRecordings();
    });
};

function finaliseRecordings()
{
    var tasks = [];

    var makeTask = function (recordingid) {
        return function (callback) {
            finaliseRecording(recordingid, function () {
                callback();
            });
        };
    };

    for (var id in recordings) {
        if (!recordings[id].endtime) {
            tasks.push(makeTask(id));
        }
    }

    series(tasks, function () {
        cleanSpace();
        continuousRecordings();
    });
}

function finaliseRecording(recordingid, callback)
{
    var filename = require('path').join(dir, recordingid + '.mp4');

    streamcore.finalize(filename, function () {
        fs.stat(filename, function (err, stat) {

            if (err) {

                if (err.code === 'ENOENT') {
                    deleteRecording(recordingid, callback);
                    return;
                }

                logger.error(err);

                if (callback) {
                    callback();
                }

                return;
            }

            if (stat.size < 1024) {
                deleteRecording(recordingid, callback);
                return;
            }

            recordings[recordingid].endtime = +new Date(stat.mtime);
            recordings[recordingid].size = stat.size;
            cfg.recordings.set('recordings', recordings, callback);

            streamcore.getDuration(filename, function (duration) {
                if (duration) {
                    recordings[recordingid].duration = duration;
                    cfg.recordings.set('recordings', recordings);
                }
            });
        });
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
    var quota = cfg.get('recordingQuota', 100);

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
    var tasks = [];

    list.forEach(function (recording) {
        total += recording.size;
        if (total > quota) {
            tasks.push(function (callback) {
                deleteRecording(recording.id, function () {
                    callback();
                });
            });
        }
    });

    series(tasks, function () {
        setTimeout(cleanSpace, 5 * 60 * 1000);
    });
}

function enableContinuousRecording(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (camera && !camera.continuous_recording) {
        camera.continuous_recording = true;
        cfg.set('cameras', cameras);
        continuousRecord(cameraid);
        if (typeof cb === 'function') {
            cb(true);
        }
    } else {
        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

function disableContinuousRecording(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (camera && camera.continuous_recording) {
        camera.continuous_recording = false;
        cfg.set('cameras', cameras);
        if (continuous_recordings[cameraid]) {
            stopRecording(continuous_recordings[cameraid]);
        }
        if (typeof cb === 'function') {
            cb(true);
        }
    } else {
        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

function continuousRecord(cameraid)
{
    var record = function() {
        startRecording(cameraid, function (recordingid) {
            if (!recordingid) {
                return;
            }
            continuous_recordings[cameraid] = recordingid;
            recordingTimeouts[recordingid] = setTimeout(function () {
                record();
                stopRecording(recordingid);
                delete recordingTimeouts[recordingid];
            }, 60 * 60 * 1000);
        });
    };

    record();
}

function getSocketIOStream(playbackid, recording, seek, options)
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
            image: chunk,
            size: recording.size,
            seek: seek,
            mime: recording.mime
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
            conn.local('recordingFrame', frame, next);
        } else {
            conn.send('recordingFrame', frame, next);
        }
    };

    var writable = new Streamer();

    return writable;
}

var recordingOptions = {
    width: -1,
    height: -1,
    framerate: 10,
    encoder: 'h264'
};

function checkStream(camera, cb)
{
    if (camera.screencapture || camera.local) {
        return cb(true);
    }

    var parts = require('url').parse(camera.rtsp_recording || camera.rtsp || camera.mjpeg || camera.snapshot);

    var port = parts.port || ports_by_protocol[parts.protocol];

    tcpp.probe(parts.hostname, port, function (err, available) {
        logger.debug(err);
        cb(available);
    });
}

function startRecording(cameraid, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    checkStream(camera, function (available) {

        if (!available) {
            logger.debug('Recording camera', cameraid, 'unavailable');
            setTimeout(startRecording, 5000, cameraid, cb);
            return;
        }

        var recordingid = require('uuid/v4')();

        recordings[recordingid] = {
            cameraid: cameraid,
            starttime: Date.now(),
            mime: 'video/mp4'
        };

        cfg.recordings.set('recordings', recordings);

        var filename = require('path').join(dir, recordingid + '.mp4');
        var thumbnail = require('path').join(dir, recordingid + '.jpeg');

        if (camera.rtsp_recording || camera.rtsp) {

            rtsp_procs[recordingid] = streamcore.recordRTSP(camera, filename);

            rtsp_procs[recordingid].on('exit', function (code) {
                delete rtsp_procs[recordingid];
                if (code !== 0) {
                    logger.debug('Recording camera', cameraid, 'interrrupted');
                    setTimeout(startRecording, 5000, cameraid, cb);
                    clearTimeout(recordingTimeouts[recordingid]);
                    delete recordingTimeouts[recordingid];
                    finaliseRecording(recordingid);
                }
            });

        } else {
            var destination = fs.createWriteStream(filename, 'binary');
            streamcore.runStream(cameraid, camera, recordingOptions, destination, recordingid);
        }

        streamcore.getThumbnail(camera, function (image) {
            fs.writeFile(thumbnail, image, function () {

            });
        });

        cb(recordingid);

        var rec = {
            id: recordingid,
            cameraid: recordings[recordingid].cameraid,
            starttime: recordings[recordingid].starttime,
            mime: recordings[recordingid].mime,
        };

        conn.broadcast('recordingAdded', rec);
    });
}

function stopRecording(recordingid, cb)
{
    var finalise = function () {
        finaliseRecording(recordingid, cb);
    };

    if (rtsp_procs[recordingid]) {
        rtsp_procs[recordingid].removeAllListeners('exit');
        rtsp_procs[recordingid].kill('SIGINT');
        rtsp_procs[recordingid].on('exit', finalise);
        delete rtsp_procs[recordingid];
    } else {
        streamcore.stopStreaming(recordingid, finalise);
    }
}

function startPlayback(recordingid, playbackid, options)
{
    if (!recordings[recordingid]) {
        logger.error('Unknown recording', recordingid);
        return;
    }

    var recording = recordings[recordingid];

    var ext;

    if (recording.mime === 'video/mp4') {
        ext = '.mp4';
    } else {
        ext = '.webm';
    }

    var filename = require('path').join(dir, recordingid + ext);

    var source, seek;

    if (options.encoder === 'vp8') {

        if (options.range) {

            seek = {
                start: options.range.start >= 0 ? options.range.start : options.range.start + recording.size,
                end: options.range.end > 0 ? options.range.end : options.range.end + recording.size
            };

            if (seek.start > seek.end) {
                seek = undefined;
            }
        }

        source = fs.createReadStream(filename, seek);

        source.stop = function () {
            source.destroy();
        };

    } else {
        source = streamcore.playRecording(filename, options);
    }

    playbacks[playbackid] = source;

    source.on('error', function (err) {
        logger.error('Playback error', err);
    });

    source.once('end', function () {
        conn.broadcast('playbackEnded', playbackid);
    });

    var sio = getSocketIOStream(playbackid, recording, seek, options);

    source.pipe(sio);
}

function endPlayback(playbackid)
{
    if (playbacks[playbackid]) {
        playbacks[playbackid].unpipe();
        playbacks[playbackid].stop();
        delete playbacks[playbackid];
    }
}

function getRecordings(cb)
{
    var result = hash_to_array(recordings);

    // Only return completed recordings
    result = result.filter(function (recording) {
        return recording.endtime;
    });

    if (typeof cb === 'function') {
        cb(result);
    }
}

function getSomeRecordings(filter, cb)
{
    var result = hash_to_array(recordings);

    result = result.filter(function (recording) {
        return recording.endtime;
    }).filter(function (recording) {
        return !filter.cameraid || filter.cameraid === recording.cameraid;
    }).filter(function (recording) {
        return !filter.start || recording.starttime >= filter.start;
    }).filter(function (recording) {
        return !filter.end || recording.starttime <= filter.end;
    });

    if (filter.limit > 0) {
        result = result.slice(0, filter.limit);
    }

    if (typeof cb === 'function') {
        cb(result);
    }
}

function deleteRecording(recordingid, cb)
{
    if (!recordings.hasOwnProperty(recordingid)) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    if (/^[a-f0-9-]+$/.test(recordingid) === false) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var ext;

    if (recordings[recordingid].mime === 'video/mp4') {
        ext = '.mp4';
    } else {
        ext = '.webm';
    }

    var filename = require('path').join(dir, recordingid + ext);
    var thumbnail = require('path').join(dir, recordingid + '.jpeg');

    series([
        function (callback) {
            fs.unlink(filename, function (err) {
                if (err && err.code !== 'ENOENT') {
                    logger.warn('Failed to delete recording at ' + filename, err);
                }
                callback();
            });
        },
        function (callback) {
            fs.unlink(thumbnail, function (err) {
                if (err && err.code !== 'ENOENT') {
                    logger.warn('Failed to delete thumbnail at ' + thumbnail, err);
                }
                callback();
            });
        }
    ],
    function () {
        conn.broadcast('recordingDeleted', recordingid);
        delete recordings[recordingid];
        cfg.recordings.set('recordings', recordings, cb);
    });
}

function getRecordingThumbnail(recordingid, cb)
{
    var thumbnail = require('path').join(dir, recordingid + '.jpeg');

    fs.readFile(thumbnail, function (err, data) {

        if (err) {

            logger.error(err);

            if (typeof cb === 'function') {
                cb(null);
            }

            return false;
        }

        if (typeof cb === 'function') {
            cb(data);
        }
    });
}
