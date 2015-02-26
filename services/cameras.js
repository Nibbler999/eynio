"use strict";

var logger;

var cameras = {};

var Cams = function(conn, l) {

    logger = l.child({component: 'Cameras'});

    // var cfg = require('../configuration.js');
    // cameras = cfg.get('cameras', {});

    // Temporary
    conn.emit('getCameras', function (cams) {

        cams.forEach(function (cam) {

            var id = cam.id;

            delete cam.id;
            delete cam.server;
            delete cam.play_mp4;
            delete cam.play_mjpeg;

            cameras[id] = cam;
        });

        Cams.save();
    });

    conn.on('getCameras', function (cb) {

        var cam_array = hash_to_array(cameras);

        conn.emit('cameras', cam_array);

        if (cb) cb(cam_array);
    });

    conn.on('deleteCamera', function (cameraid, cb) {

        delete cameras[cameraid];

        conn.emit('cameraDeleted', cameraid);

        Cams.save();

        if (cb) cb();
    });

    conn.on('updateCamera', function (cameraid, camera, cb) {

        cameras[cameraid] = camera;

        conn.emit('cameraUpdated', camera);

        Cams.save();

        if (cb) cb();
    });

    conn.on('getCamera', function (cameraid, cb) {

        conn.emit('camera', cameras[cameraid]);

        if (cb) cb(cameras[cameraid]);
    });

    conn.on('addCamera', function (camera, cb) {
        var cameraid = require('node-uuid').v4();
        cameras[cameraid] = camera;
        Cams.save();

        if (cb) cb();
    });
};

Cams.save = function() {

    var cfg = require('../configuration.js');

    cfg.set('cameras', cameras);
};

function hash_to_array(hash)
{
    var array = [], object;

    for (var key in hash) {

        object = {
            id: key
        };

        for (var key2 in hash[key]) {
            object[key2] = hash[key][key2];
        }

        array.push(object);
    }

    return array;
}

module.exports = Cams;
