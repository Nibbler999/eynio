"use strict";

var conn;

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'MJPEG'});

    conn.on('makeMJPEG', function (camera) {
        makeMJPEG(camera);
    });
};

function makeMJPEG(camera)
{
    logger.debug('Creating MJPEG stream from ' + camera.url);

    var numcores = require('os').cpus().length;
    
    if (numcores > 1) {
    
        var child = require('child_process').fork(__dirname + '/mjpeg-child.js');

        child.on('message', function(message) {
            logger.error(camera.url, message);
        });

        child.send(camera);
        
    } else {
    
        require('tls').connect({host: 'nhome.ba', servername: 'nhome.ba', port: 8082}, function() {

            this.setNoDelay();

            this.write(camera.id);
            
            this.write("HTTP/1.1 200 OK\r\n");
            this.write("Content-Type: multipart/x-mixed-replace; boundary=myboundary\r\n");
            this.write("Cache-Control: no-cache\r\n");
            this.write("Connection: close\r\n");
            this.write("Pragma: no-cache\r\n");
            this.write("\r\n");

            updateSnapshot(camera, this);
            
            this.on('error', function(err) {
                logger.error(camera.url, err.message);
            });
        });
    }
}

function updateSnapshot(camera, res)
{
    var timer, options = {encoding: null, auth: camera.auth};
    
    var request = require('request');
    
    var refresh = function () {

    request(camera.url, options, function (error, response, body) {
    
        if (!error && response.statusCode === 200) {

            timer = setTimeout(refresh, 1000);
            
            res.write("--myboundary\r\n");
            res.write("Content-Type: image/jpeg\r\n");
            res.write("Content-Length: " + body.length + "\r\n");
            res.write("\r\n");
            res.write(body, 'binary');
            res.write("\r\n");

            } else if (response) {
                logger.error(camera.url, response);
            } else {
                logger.error(camera.url, error.message);
            }
        });
    };
            
    res.on('close', function() {
        clearTimeout(timer);
    });

    refresh();
}

