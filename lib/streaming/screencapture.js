"use strict";

var child_process = require('child_process');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var ffmpeg = require('./ffmpeg.js');

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for screen capture');
        return false;
    }

    var args = ['-loglevel', ffmpeg.loglevel, '-f', 'x11grab', '-video_size', camera.screencapture.size, '-i', camera.screencapture.screen, '-vframes', 1, '-f', 'mjpeg', '-'];

    var opts = { encoding: 'buffer', maxBuffer: 2 * 1024 * 1024, timeout: 15000 };

    logger.debug(ffmpeg.path, args.join(' '));

    child_process.execFile(ffmpeg.path, args, opts, function (err, stdout, stderr) {

        if (err || !stdout.length) {
            cb(null);
            return logger.error(err, stderr.toString());
        }

        cb(stdout);
    });
};

streamingMethod.stream = function (logger, camera, cb) {

    var ffmpeg = require('./ffmpeg.js');

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for screen capture');
        return false;
    }

    var args = ['-loglevel', ffmpeg.loglevel, '-f', 'x11grab', '-video_size', camera.screencapture.size, '-i', camera.screencapture.screen, '-f', 'mjpeg', '-'];

    var child = child_process.spawn(ffmpeg.path, args);

    child.on('error', function (e) {
        logger.error('screencapture', e);
    });

    logger.debug(ffmpeg.path, args.join(' '));

    child.stderr.on('data', function (data) {
        logger.error(data.toString());
    });

    child.stdout.stop = function () {
        child.kill('SIGINT');
    };

    cb(child.stdout);
};

module.exports = streamingMethod;

