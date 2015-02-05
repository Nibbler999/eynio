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

    var child = require('child_process').fork(__dirname + '/mjpeg-child.js');

    child.on('message', function(message) {
        logger.error(camera.url, message);
    });

    child.send(camera);
}
