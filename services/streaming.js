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

    var auth;

    var MjpegConsumer = require("mjpeg-consumer");
    var consumer = new MjpegConsumer();
    var proc, args;
    
    if (camera.snapshot) {

        var url = getURL(camera, 'snapshot');
        
        args = ['-re', '-framerate', 1, '-f', 'image2', '-vcodec', 'mjpeg', '-loop', 1, '-i', url, '-f', 'image2', '-r', 1, '-updatefirst', '1', '-'];
        
    } else if (camera.mjpeg) {

        var url = getURL(camera, 'mjpeg');
        
        args = ['-i', url, '-f', 'image2', '-r', 1, '-updatefirst', '1', '-'];

    } else if (camera.rtsp) {
    
        var url = getURL(camera, 'rtsp');
        
        args = ['-i', url, '-f', 'image2', '-r', 1, '-updatefirst', '1', '-'];
        
    } else {
        return false;
    }
    
    proc = procs[cameraid] = require('child_process').spawn('ffmpeg', args);
    
    if (logger.debug()) {
        proc.stderr.on('data', function (data) {
            logger.debug('ffmpeg', url, data.toString());
        });
    }
     
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
        procs[cameraid].kill();
    }
}

