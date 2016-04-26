"use strict";

var MjpegConsumer = require('./mjpeg-consumer');
var child_process = require('child_process');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var ffmpeg = require('./ffmpeg.js')(logger);

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for local streaming');
        return false;
    }

    var args = ['-f', 'v4l2', '-input_format', 'mjpeg', '-video_size', camera.local.size, '-i', camera.local.device, '-codec:v', 'copy', '-vframes', 1, '-f', 'mjpeg', '-'];

    var opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    var child = child_process.spawn(ffmpeg.path, args, opts);

    child.on('error', function (e) {
        logger.error('local', e);
    });

    if (logger.debug()) {

        logger.debug('local', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('local', camera.local.device, data.toString());
        });
    }

    var consumer = new MjpegConsumer();

    child.stdout.pipe(consumer);

    consumer.once('data', function (image) {
        cb(image);
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

    var ffmpeg = require('./ffmpeg.js')(logger);

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for local streaming');
        return false;
    }

    var args = ['-f', 'v4l2', '-input_format', 'mjpeg', '-video_size', camera.local.size, '-i', camera.local.device, '-codec:v', 'copy', '-f', 'mjpeg', '-'];

    var opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    var child = child_process.spawn(ffmpeg.path, args, opts);

    child.on('error', function (e) {
        logger.error('local', e);
    });

    if (logger.debug()) {

        logger.debug('local', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('local', camera.local.device, data.toString());
        });
    }

    child.stdout.stop = function () {
        child.stdout.end();
    };

    cb(child.stdout);
};

module.exports = streamingMethod;

