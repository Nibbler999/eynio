"use strict";

var MjpegConsumer = require('./mjpeg-consumer');
var child_process = require('child_process');

var streamingMethod = {};

streamingMethod.snapshot = function (logger, camera, cb) {

    var ffmpeg = require('./ffmpeg.js');

    if (!ffmpeg.available) {
        logger.error('Need ffmpeg for RTSP streaming');
        return false;
    }

    var url = camera.rtsp;

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    var args = ['-loglevel', ffmpeg.loglevel, '-f', 'rtsp', '-rtsp_transport', 'tcp', '-i', url, '-f', 'mjpeg', '-vframes', '1', '-qscale:v', 2, '-'];

    var child = child_process.spawn(ffmpeg.path, args);

    child.on('error', function (e) {
        logger.error('rtsp', e);
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
        logger.error('Need ffmpeg for RTSP streaming');
        return false;
    }

    var url = camera.rtsp;

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    var args = ['-loglevel', ffmpeg.loglevel, '-f', 'rtsp', '-rtsp_transport', 'tcp', '-i', url, '-f', 'mjpeg', '-qscale:v', 2, '-vsync', 'vfr', '-'];

    var child = child_process.spawn(ffmpeg.path, args);

    child.on('error', function (e) {
        logger.error('rtsp', e);
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

