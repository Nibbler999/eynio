"use strict";

var MjpegConsumer = require('mjpeg-consumer');
var Limiter = require('write-limiter');
var child_process = require('child_process');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var args = camera.executable.split(' ');

    var program = args.shift();

    var opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    var child = child_process.spawn(program, args, opts);

    child.on('error', function (e) {
        logger.error('executable', e);
    });

    if (logger.debug()) {

        logger.debug('executable', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('executable', camera.executable, data.toString());
        });
    }

    var consumer = new MjpegConsumer();

    child.stdout.pipe(consumer);

    consumer.once('data', function (image) {
        cb(image);
        child.kill('SIGKILL');
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

    var args = camera.executable.split(' ');

    var program = args.shift();

    var opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    var child = child_process.spawn(program, args, opts);

    child.on('error', function (e) {
        logger.error('executable', e);
    });

    if (logger.debug()) {

        logger.debug('executable', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('executable', camera.executable, data.toString());
        });
    }

    var consumer = new MjpegConsumer();

    var source = child.stdout.pipe(consumer);

    if (options.framerate > 0) {
        var limiter = new Limiter(1000 / options.framerate);
        source = source.pipe(limiter);
    }

    source.on('end', function() {
        child.kill('SIGKILL');
    });

    cb(source);
};

module.exports = streamingMethod;

