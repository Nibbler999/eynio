"use strict";

var stream = require('stream');
var util = require('util');
var fs = require('fs');

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var streamcore = require('../streaming/core.js');

var conn, logger;

var playbacks = {};

var recordings;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Recording'});

    var oldrecordings = cfg.get('recordings');

    if (oldrecordings) {
        cfg.recordings.set('recordings', oldrecordings);
        cfg.delete('recordings');
    }

    recordings = cfg.recordings.get('recordings', {});

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

        finaliseRecordings();

        setTimeout(continuousRecordings, 3000);
    });
};

function finaliseRecordings()
{
    for (var id in recordings) {

        if (!recordings[id].endtime) {
            finaliseRecording(id);
        }
    }
}

function finaliseRecording(recordingid)
{
    var filename = require('path').join(cfg.getVideoDirectory(), recordingid + '.webm');

    streamcore.finalize(filename, function () {
        fs.stat(filename, function (err, stat) {

            if (err) {
                logger.error(err);
                return;
            }

            recordings[recordingid].endtime = +new Date(stat.mtime);
            recordings[recordingid].size = stat.size;

            cfg.recordings.set('recordings', recordings);
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

function getSocketIOStream(playbackid, size, seek, options)
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
            size: size,
            seek: seek
        };

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
    encoder: 'vp8'
};

function startRecording(cameraid, cb)
{
    var recordingid = require('uuid/v4')();

    recordings[recordingid] = {
        cameraid: cameraid,
        starttime: Date.now()
    };

    cfg.recordings.set('recordings', recordings);

    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    var dir = cfg.getVideoDirectory();

    var filename = require('path').join(dir, recordingid + '.webm');
    var thumbnail = require('path').join(dir, recordingid + '.jpeg');

    var destination = fs.createWriteStream(filename, 'binary');

    streamcore.runStream(cameraid, camera, recordingOptions, destination, recordingid, thumbnail);

    cb(recordingid);

    var rec = {
        id: recordingid,
        cameraid: recordings[recordingid].cameraid,
        starttime: recordings[recordingid].starttime
    };

    conn.broadcast('recordingAdded', rec);
}

function stopRecording(recordingid, cb)
{
    streamcore.stopStreaming(recordingid);

    finaliseRecording(recordingid);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function startPlayback(recordingid, playbackid, options)
{
    if (!recordings[recordingid]) {
        logger.error('Unknown recording', recordingid);
        return;
    }

    var filename = require('path').join(cfg.getVideoDirectory(), recordingid + '.webm');

    var source, seek;

    var size = recordings[recordingid].size;

    if (options.encoder === 'vp8') {

        if (options.range) {

            seek = {
                start: options.range.start >= 0 ? options.range.start : options.range.start + size,
                end: options.range.end > 0 ? options.range.end : options.range.end + size
            };

            if (seek.start > seek.end) {
                seek = undefined;
            }
        }

        source = fs.createReadStream(filename, seek);

    } else {
        source = playbacks[playbackid] = streamcore.playRecording(filename, options);
    }

    source.on('error', function (err) {
        logger.error('Playback error', err);
    });

    source.once('end', function () {
        conn.broadcast('playbackEnded', playbackid);
    });

    var sio = getSocketIOStream(playbackid, size, seek, options);

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

    delete recordings[recordingid];

    cfg.recordings.set('recordings', recordings);

    if (/^[a-f0-9-]+$/.test(recordingid)) {

        var dir = cfg.getVideoDirectory();

        var filename = require('path').join(dir, recordingid + '.webm');
        var thumbnail = require('path').join(dir, recordingid + '.jpeg');

        fs.unlink(filename, function (err) {
            if (err) {
                logger.warn('Failed to delete recording at ' + filename, err);
            }
        });

        fs.unlink(thumbnail, function (err) {
            if (err) {
                logger.warn('Failed to delete thumbnail at ' + thumbnail, err);
            }
        });

        conn.broadcast('recordingDeleted', recordingid);

        if (typeof cb === 'function') {
            cb(true);
        }

    } else {

        if (typeof cb === 'function') {
            cb(false);
        }
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
                cb(null);
            }

            return false;
        }

        if (typeof cb === 'function') {
            cb(data);
        }
    });
}

