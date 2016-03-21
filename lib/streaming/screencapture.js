"use strict";

var MjpegConsumer = require('./mjpeg-consumer');
var child_process = require('child_process');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var ffmpeg = require('./ffmpeg.js')(logger);

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for screen capture');
        return false;
    }

    var args = ['-f', 'x11grab', '-video_size', camera.screencapture.size, '-i', camera.screencapture.screen, '-vframes', 1, '-f', 'mjpeg', '-'];

    var opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    var child = child_process.spawn(ffmpeg.path, args, opts);

    child.on('error', function (e) {
        logger.error('screencapture', e);
    });

    if (logger.debug()) {

        logger.debug('screencapture', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('screencapture', camera.screencapture.screen, data.toString());
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
        logger.error('Need ffmpeg for screen capture');
        return false;
    }

    var args = ['-f', 'x11grab']

    if (options.framerate > 0) {
        args.push('-framerate', options.framerate);
    }

    args.push('-video_size', camera.screencapture.size, '-i', camera.screencapture.screen, '-f', 'mjpeg', '-');

    var opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    var child = child_process.spawn(ffmpeg.path, args, opts);

    child.on('error', function (e) {
        logger.error('screencapture', e);
    });

    if (logger.debug()) {

        logger.debug('screencapture', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('screencapture', camera.screencapture.screen, data.toString());
        });
    }

    var consumer = new MjpegConsumer();

    var source = child.stdout.pipe(consumer);

    var ender = source.end;

    source.end = function () {
        ender.apply(source, arguments);
        source.emit('end');
    };

    source.once('end', function() {
        child.kill('SIGKILL');
    });

    cb(source);
};

module.exports = streamingMethod;

