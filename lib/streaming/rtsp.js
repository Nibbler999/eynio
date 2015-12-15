"use strict";

var MjpegConsumer = require('mjpeg-consumer');
var Limiter = require('write-limiter');
var child_process = require('child_process');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var ffmpeg = require('./ffmpeg.js')(logger);

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for RTSP streaming');
        return false;
    }

    var url = camera.rtsp;

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    var args = ['-f', 'rtsp', '-rtsp_transport', 'tcp', '-i', url];

    args.push('-f', 'mpjpeg');

    args.push('-vframes', '1');

    args.push('-qscale:v', 2);

    args.push('-');

    var child = child_process.spawn('ffmpeg', args, ffmpeg.opts);

    child.on('error', function (e) {
        logger.error('ffmpeg', e);
    });

    if (logger.debug()) {

        logger.debug('ffmpeg', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('ffmpeg', camera.rtsp, data.toString());
        });
    }

    var consumer = new MjpegConsumer();

    var source = child.stdout.pipe(consumer);

    consumer.once('data', function (image) {
        cb(image);
    });
};

streamingMethod.stream = function (logger, camera, options, cb) {

    var ffmpeg = require('./ffmpeg.js')(logger);

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for RTSP streaming');
        return false;
    }

    var url = camera.rtsp;

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    var args = ['-f', 'rtsp', '-rtsp_transport', 'tcp', '-i', url];

    args.push('-f', 'mpjpeg');

    if (options.framerate > 0) {
        args.push('-r', options.framerate);
    }

    args.push('-qscale:v', 2);

    args.push('-');

    var child = child_process.spawn('ffmpeg', args, ffmpeg.opts);

    child.on('error', function (e) {
        logger.error('ffmpeg', e);
    });

    if (logger.debug()) {

        logger.debug('ffmpeg', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('ffmpeg', camera.rtsp, data.toString());
        });
    }

    var consumer = new MjpegConsumer();

    var source = child.stdout.pipe(consumer);

    if (options.framerate > 0) {
        var limiter = new Limiter(1000 / options.framerate);
        source = source.pipe(limiter);
    }

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

