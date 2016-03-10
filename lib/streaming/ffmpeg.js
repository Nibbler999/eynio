"use strict";

var stream = require('stream');
var MjpegConsumer = require('./mjpeg-consumer');
var child_process = require('child_process');
var util = require('util');
var fs = require('fs');
var WebMParser = require('./webm-parser');

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
ffmpeg.path = 'ffmpeg';

ffmpeg.check = function (cb) {

    if (process.platform === 'win32') {

        ffmpeg.available = true;

        // Detect 32bit app on 64bit windows
        if (process.env.PROCESSOR_ARCHITEW6432) {
            ffmpeg.path = 'ffmpeg64';
        }

        process.nextTick(cb, true);

        return;
    }

    try {

        var child = child_process.spawn(ffmpeg.path, ['-version']);

        child.on('error', function () {
            ffmpeg.available = false;
            cb(ffmpeg.available);
        });

        child.stdout.once('data', function (data) {
            logger.debug(data.toString());
            ffmpeg.available = true;
            cb(ffmpeg.available);
        });

    } catch (e) {
        logger.warn(e);
        ffmpeg.available = false;
        cb(ffmpeg.available);
    }
};

ffmpeg.threads = require('os').cpus().length;

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
        args.push('-f', 'mpeg1video', '-b:v', '500k', '-bf', 0, '-mb_threshold', 100, '-g', options.framerate * 2, '-r', 24, '-');
        break;

    case 'vp8':
        // Intended for Android 4.0+
        vf += ",setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'";
        args.push('-vf', vf);
        args.push('-f', 'webm', '-c:v', 'libvpx', '-b:v', '500k', '-crf', 23, '-threads', ffmpeg.threads, '-keyint_min', options.framerate * 5, '-r', options.framerate, '-quality', 'realtime', '-');
        break;

    case 'vp8-mse':
        vf += ",setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'";
        args.push('-vf', vf);
        args.push('-f', 'webm', '-dash', 1, '-c:v', 'libvpx', '-b:v', '500k', '-crf', 23, '-threads', ffmpeg.threads, '-g', options.framerate * 2, '-r', options.framerate, '-quality', 'realtime', '-');

        segmenter = new WebMParser();

        break;

    case 'vp9':
        // Intended for Android 4.4+
        // Currently very slow compared to vp8
        vf += ",setpts='(RTCTIME - RTCSTART) / (TB * 1000000)'";
        args.push('-vf', vf);
        args.push('-f', 'webm', '-c:v', 'libvpx-vp9', '-b:v', '500k', '-crf', 23, '-threads', ffmpeg.threads, '-keyint_min', options.framerate * 5, '-r', options.framerate, '-quality', 'realtime', '-');
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

        args.push('-f', 'mjpeg', '-');
        segmenter = new MjpegConsumer();
        break;
    }

    var child = require('child_process').spawn(ffmpeg.path, args, ffmpeg.opts);

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

    case 'vp8-mse':
        args.push('-vf', vf);
        args.push('-f', 'webm', '-dash', 1, '-c:v', 'copy', '-');

        segmenter = new WebMParser();

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
        args.push('-f', 'mjpeg', '-');
        segmenter = new MjpegConsumer();
        break;
    }

    var child = require('child_process').spawn(ffmpeg.path, args, ffmpeg.opts);

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

ffmpeg.finalize = function (filename, cb) {

    var args = ['-i', filename, '-vcodec', 'copy', '-f', 'webm', filename + '.tmp'];

    var child = require('child_process').spawn(ffmpeg.path, args, ffmpeg.opts);

    child.on('error', function (e) {
        logger.error('ffmpeg', e);
    });

    child.on('close', function () {
        fs.rename(filename + '.tmp', filename, cb);
    });

    if (logger.debug()) {

        logger.debug('ffmpeg', args.join(' '));

        child.stderr.on('data', function (data) {
            logger.debug('ffmpeg', data.toString());
        });
    }
};

function makeDuplex(writable, readable)
{
    var Duplex = stream.Duplex;
    util.inherits(Streamer, Duplex);

    function Streamer() {
        Duplex.call(this, { objectMode: true });
        this.ready = true;
    }

    Streamer.prototype._read = function () { };

    Streamer.prototype._write = function (chunk, encoding, next) {
        if (this.ready) {
            this.ready = writable.write(chunk);
        }
        next();
    };

    var duplex = new Streamer();

    writable.on('error', function (err) {
        logger.error('ffmpeg error', err);
        duplex.emit('error', err);
    });

    writable.on('drain', function () {
        duplex.ready = true;
    });

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

