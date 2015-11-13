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

ffmpeg.getEncoder = function (options, rotation) {

    var args = ['-f', 'mjpeg', '-i', '-'];

    var vf = '';

    var segmenter;

    if (rotation === 90) {
        vf = 'transpose=1,';
    } else if (rotation === 180) {
        vf = 'transpose=1,transpose=1,';
    } else if (rotation === 270) {
        vf = 'transpose=2,';
    }

    vf += 'scale=' + options.width + ':' + options.height;

    switch (options.encoder) {

    case 'mpeg1':
        // Intended for web with jsmpeg decoder.
        // B frames not supported by decoder
        // mpeg1 only supports framerates of 24, 25, 30, 50, 60
        args.push('-vf', vf);
        args.push('-qscale:v', 5);
        args.push('-f', 'mpeg1video', '-b:v', '500k', '-bf', 0, '-mb_threshold', 100, '-g', options.framerate * 5, '-r', 24, '-');
        break;

    case 'vp8':
        // Intended for Android 4.0+
        // Seems to be slower when using multiple threads so this is not enabled
        vf += ",setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'";
        args.push('-vf', vf);
        args.push('-qscale:v', 5);
        args.push('-f', 'webm', '-c:v', 'libvpx', '-b:v', '500k', '-static-thresh', 100, '-keyint_min', options.framerate * 5, '-r', options.framerate, '-quality', 'realtime', '-');
        break;

    case 'vp9':
        // Intended for Android 4.4+
        // Currently very slow compared to vp8
        vf += ",setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'";
        args.push('-vf', vf);
        args.push('-qscale:v', 5);
        args.push('-f', 'webm', '-c:v', 'libvpx-vp9', '-b:v', '500k', '-static-thresh', 100, '-keyint_min', options.framerate * 5, '-r', options.framerate, '-quality', 'realtime', '-');
        break;

    case 'jpeg':
    default:
        // Legacy streaming method
        // JPEG sequence
        // High bandwidth but supported everywhere
        args.push('-vf', vf);

        if (options.height !== 120) {
            args.push('-qscale:v', 9);
        }

        args.push('-f', 'mpjpeg', '-');
        segmenter = new MjpegConsumer();
        break;
    }

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

    var output = child.stdout;

    if (segmenter) {
        output = output.pipe(segmenter);
    }

    var duplex = makeDuplex(child.stdin, output);

    return duplex;
};

ffmpeg.playRecording = function (filename, options) {

    var args = ['-re', '-i', filename];

    var segmenter;

    var vf = 'scale=' + options.width + ':' + options.height;

    switch (options.encoder) {

    case 'mpeg1':
        // Intended for web with jsmpeg decoder.
        // B frames not supported by decoder
        // mpeg1 only supports framerates of 24, 25, 30, 50, 60
        args.push('-vf', vf);
        args.push('-qscale:v', 5);
        args.push('-f', 'mpeg1video', '-b:v', '500k', '-bf', 0, '-mb_threshold', 100, '-g', options.framerate * 5, '-r', 24, '-');
        break;

    case 'vp8':
        // Intended for Android 4.0+
        // Seems to be slower when using multiple threads so this is not enabled
        vf += ",setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'";
        args.push('-vf', vf);
        args.push('-qscale:v', 5);
        args.push('-f', 'webm', '-c:v', 'libvpx', '-b:v', '500k', '-static-thresh', 100, '-keyint_min', options.framerate * 5, '-r', options.framerate, '-quality', 'realtime', '-');
        break;

    case 'vp9':
        // Intended for Android 4.4+
        // Currently very slow compared to vp8
        vf += ",setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'";
        args.push('-vf', vf);
        args.push('-qscale:v', 5);
        args.push('-f', 'webm', '-c:v', 'libvpx-vp9', '-b:v', '500k', '-static-thresh', 100, '-keyint_min', options.framerate * 5, '-r', options.framerate, '-quality', 'realtime', '-');
        break;

    case 'jpeg':
    default:
        // Legacy streaming method
        // JPEG sequence
        // High bandwidth but supported everywhere
        args.push('-vf', vf);

        if (options.height !== 120) {
            args.push('-qscale:v', 9);
        }

        args.push('-r', options.framerate);
        args.push('-f', 'mpjpeg', '-');
        segmenter = new MjpegConsumer();
        break;
    }

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

    var output = child.stdout;

    if (segmenter) {
        output = output.pipe(segmenter);
    }

    output.stop = function() {
        child.kill();
    };

    return output;
};

function makeDuplex(writable, readable)
{
    var Duplex = stream.Duplex;
    util.inherits(Streamer, Duplex);

    function Streamer(opt) {
        Duplex.call(this, opt);
    }

    Streamer.prototype._read = function () { };

    Streamer.prototype._write = function (chunk, encoding, next) {
        writable.write(chunk);
        next();
    };

    var duplex = new Streamer();

    duplex.on('unpipe', function () {
        writable.end();
    });

    duplex.on('finish', function () {
        writable.end();
    });

    readable.on('data', function (chunk) {
        duplex.push(chunk);
    });

    return duplex;
}

module.exports = ffmpeg;

