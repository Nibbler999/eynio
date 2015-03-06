"use strict";

var conn;

var logger, procs = {};

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Streaming'});

    conn.on('startStreaming', function (cameraid, options) {
        startStreaming(cameraid, options);
    });

    conn.on('stopStreaming', function (cameraid, options) {
        stopStreaming(cameraid, options);
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

function startStreaming(cameraid, options)
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

        args = ['-f', 'image2', '-re', '-framerate', options.framerate, '-vcodec', 'mjpeg', '-loop', 1, '-i', url];

    } else if (camera.mjpeg) {

        url = getURL(camera, 'mjpeg');

        args = ['-f', 'mjpeg', '-i', url];

    } else if (camera.rtsp) {

        url = getURL(camera, 'rtsp');

        args = ['-f', 'rtsp', '-i', url];

    } else {
        return false;
    }

    args.push('-f', 'mpjpeg', '-qscale:v', 5);
    
    if (options.width > 0 || options.height > 0) {
        args.push('-vf', 'scale=' + options.width + ':' + options.height);
    }
    
    args.push('-r', options.framerate);
    
    args.push('-');
    
    var key = cameraKey(cameraid, options);
    
    var proc = procs[key] = require('child_process').spawn('ffmpeg', args);

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
            options: options,
            image: image
        };

        conn.broadcast('cameraFrame', frame);
    });
}

function stopStreaming(cameraid, options)
{
    var key = cameraKey(cameraid, options);
    
    if (procs[key]) {
        procs[key].kill('SIGKILL');
    }
}

function cameraKey(cameraid, options)
{
    return [cameraid, options.width, options.height, options.framerate].join('-');
}

