"use strict";

var MjpegConsumer = require('./mjpeg-consumer');
var child_process = require('child_process');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var ffmpeg = require('./ffmpeg.js');

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for screen capture');
        return false;
    }

    var args = ['-loglevel', ffmpeg.loglevel, '-f', 'x11grab', '-video_size', camera.screencapture.size, '-i', camera.screencapture.screen, '-vframes', 1, '-f', 'mjpeg', '-'];

    var child = child_process.spawn(ffmpeg.path, args);

    child.on('error', function (e) {
        logger.error('screencapture', e);
    });

    logger.debug(ffmpeg.path, args.join(' '));

    child.stderr.on('data', function (data) {
        logger.error(data.toString());
    });

    var consumer = new MjpegConsumer();

    child.stdout.pipe(consumer);

    consumer.once('data', function (image) {
        cb(image);
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

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
        child.stdout.end();
        child.kill('SIGKILL');
    };

    cb(child.stdout);
};

module.exports = streamingMethod;

