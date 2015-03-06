"use strict";

var conn;

var logger, procs = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    conn.on('startStreaming', function (cameraid) {
        startStreaming(cameraid);
    });

    conn.on('stopStreaming', function (cameraid) {
        stopStreaming(cameraid);
    });
};

function getURL(camera, format)
{
    var url = camera[format];

    if (camera.auth_name) {
        var p = require('url').parse(url);
        url = p.protocol + '//' + camera.auth_name + ':' + camera.auth_pass + '@' + p.host + p.path;
    }

    return url;
}

function startStreaming(cameraid)
{
    logger.debug('Creating stream from ' + cameraid);

    var cfg = require('../configuration.js');
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    if (!camera) {
        logger.debug('Unknown camera', cameraid);
        return;
    }

    var args, url;

    if (camera.snapshot) {

        url = getURL(camera, 'snapshot');

        args = ['-f', 'image2', '-re', '-framerate', 1, '-vcodec', 'mjpeg', '-loop', 1, '-i', url, '-f', 'mpjpeg', '-qscale:v', 5, '-r', 1, '-'];

    } else if (camera.mjpeg) {

        url = getURL(camera, 'mjpeg');

        args = ['-f', 'mjpeg', '-i', url, '-f', 'mpjpeg', '-qscale:v', 5, '-vf', 'scale=-1:120', '-r', 1, '-'];

    } else if (camera.rtsp) {

        url = getURL(camera, 'rtsp');

        args = ['-f', 'rtsp', '-i', url, '-f', 'mpjpeg', '-qscale:v', 5, '-vf', 'scale=-1:120', '-r', 1, '-'];

    } else {
        return false;
    }

    var proc = procs[cameraid] = require('child_process').spawn('ffmpeg', args);

    if (logger.debug()) {
    
        logger.debug('ffmpeg', args.join(' '));
        
        proc.stderr.on('data', function (data) {
            logger.debug('ffmpeg', url, data.toString());
        });
    }

    var MjpegConsumer = require("mjpeg-consumer");
    var consumer = new MjpegConsumer();

    proc.stdout.pipe(consumer).on('data', function (image) {

        var frame = {
            camera: cameraid,
            image: image
        };

        conn.broadcast('cameraFrame', frame);
    });
}

function stopStreaming(cameraid)
{
    if (procs[cameraid]) {
        procs[cameraid].kill('SIGKILL');
    }
}

