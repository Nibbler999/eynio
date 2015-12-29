"use strict";

var conn;

var logger;

var cfg = require('../configuration.js');

var cameras = {};

var Cams = function (c, l) {

    conn = c;
    logger = l.child({component: 'Cameras'});

    cameras = cfg.get('cameras', {});

    conn.on('getCameras', function (command) {
        getCameras.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('deleteCamera', function (command) {
        deleteCamera.apply(command, command.args);
    });

    conn.on('updateCamera', function (command) {
        updateCamera.apply(command, command.args);
    });

    conn.on('getCamera', function (command) {
        getCamera.apply(command, command.args);
    });

    conn.on('addCamera', function (command) {
        addCamera.apply(command, command.args);
    });
};

Cams.save = function() {
    cfg.set('cameras', cameras);
};

function getCameras(cb)
{
    var cam_array = hash_to_array(cameras);

    require('../common.js').addDeviceProperties.call(this, cam_array);

    conn.broadcast('cameras', cam_array);

    if (typeof cb === 'function') {
        cb(cam_array);
    }
}

function getDevices(cb)
{
    var cam_array = hash_to_array(cameras);

    cam_array.forEach(function (camera) {
        camera.type = 'camera';
    });

    require('../common.js').addDeviceProperties.call(this, cam_array);

    if (typeof cb === 'function') {
        cb(cam_array);
    }
}

function deleteCamera(cameraid, cb)
{
    delete cameras[cameraid];

    conn.broadcast('cameraDeleted', cameraid);

    Cams.save();

    logger.debug('Camera', cameraid, 'deleted');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function updateCamera(camera, cb)
{
    for (var prop in camera) {
        cameras[camera.id][prop] = camera[prop];
    }

    conn.broadcast('cameraUpdated', cameras[camera.id]);

    Cams.save();

    logger.debug('Camera', camera.id, 'updated');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function getCamera(cameraid, cb)
{
    conn.broadcast('camera', cameras[cameraid]);

    if (typeof cb === 'function') {
        cb(cameras[cameraid]);
    }
}

function addCamera(camera, cb)
{
    camera.id = require('node-uuid').v4();

    cameras[camera.id] = camera;

    Cams.save();

    logger.debug('Camera', camera.id, 'added');

    conn.broadcast('cameraAdded', camera);

    if (typeof cb === 'function') {
        cb(true);
    }
}

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
