"use strict";

var stream = require('stream');
var MjpegConsumer = require('mjpeg-consumer');
var child_process = require('child_process');
var util = require('util');

var logger;

function ffmpeg(l) {

    logger = l;

    ffmpeg.opts = {
        stdio: [
            'pipe', // stdin
            'pipe', // stdout
            logger.debug() ? 'pipe' : 'ignore' // stderr
        ]
    };

    return ffmpeg;
}

ffmpeg.available = null;

ffmpeg.check = function (cb) {

    try {

        var child = child_process.spawn('ffmpeg', ['-version']);

        child.on('error', function () {
            ffmpeg.available = false;
            cb();
        });

        child.stdout.once('data', function (data) {
            logger.debug(data.toString());
            ffmpeg.available = true;
            cb();
        });

    } catch (e) {
        logger.warn(e);
        ffmpeg.available = false;
        cb();
    }
};

ffmpeg.getScaler = function (options, rotation) {

    var vf = '';

    if (rotation === 90) {
        vf = 'transpose=1,';
    } else if (rotation === 180) {
        vf = 'transpose=1,transpose=1,';
    } else if (rotation === 270) {
        vf = 'transpose=2,';
    }

    vf += 'scale=' + options.width + ':' + options.height;

    var args = ['-f', 'mjpeg', '-i', '-'];
    args.push('-vf', vf);
    args.push('-qscale:v', 9);
    args.push('-f', 'mpjpeg', '-');

    var child = require('child_process').spawn('ffmpeg', args, ffmpeg.opts);

    child.on('error', function (e) {
        logger.error('ffmpeg', e);
    });

    if (logger.debug()) {

        logger.debug('ffmpeg', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('ffmpeg', data.toString());
        });
    }

    var consumer = new MjpegConsumer();

    child.stdout.pipe(consumer);

    var Duplex = stream.Duplex;
    util.inherits(Streamer, Duplex);

    function Streamer(opt) {
        Duplex.call(this, opt);
    }

    Streamer.prototype._read = function () { };

    Streamer.prototype._write = function (chunk, encoding, next) {
        child.stdin.write(chunk);
        next();
    };

    var duplex = new Streamer();

    duplex.on('unpipe', function () {
        child.stdin.end();
    });

    duplex.on('finish', function () {
        child.stdin.end();
    });

    consumer.on('data', function (chunk) {
        duplex.push(chunk);
    });

    return duplex;
};

module.exports = ffmpeg;

