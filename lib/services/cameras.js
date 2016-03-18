"use strict";

var conn;

var logger;

var cfg = require('../configuration.js');
var deepExtend = require('deep-extend');

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

    conn.on('findCameras', function (command) {
        findCameras.apply(command, command.args);
    });

    conn.on('scanCamera', function (command) {
        scanCamera.apply(command, command.args);
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

    var cam = {};

    deepExtend(cam, camera, { type: 'camera', categories: [] });

    conn.broadcast('cameraAdded', cam);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function findCameras(cb)
{
    var onvif = require('onvif');

    onvif.Discovery.probe({timeout : 3000}, function (err, cams) {

        if (err) {
            logger.error(err);
            if (typeof cb === 'function') {
                cb([]);
            }
            return;
        }

        var results = [];

        cams.forEach(function (cam) {
            results.push(cam.hostname + ':' + cam.port);
        });

        if (typeof cb === 'function') {
            cb(results);
        }
    });
}

function scanCamera(id, username, password, cb)
{
    var hostname = id.split(':')[0];
    var port = id.split(':')[1];

    var Cam = require('onvif').Cam;

    var camera = new Cam({
        hostname: hostname,
        port: port,
        username: username,
        password: password
    }, function (err) {

        if (err) {
            logger.error(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var returned = 0;

        var camInfo = {
            auth_username: username,
            auth_password: password
        };

        camera.getDeviceInformation(function (err, result) {

            if (err) {
                logger.error(err);
            } else {
                camInfo.name = result.manufacturer + ' '+ result.model;
            }

            if (++returned === 3) {
                cb(camInfo);
            }
        });

        camera.getStreamUri({}, function (err, result) {

            if (err) {
                logger.error(err);
            } else {
                camInfo.rtsp = result.uri;
            }

            if (++returned === 3) {
                cb(camInfo);
            }
        });

        camera.getSnapshotUri({}, function (err, result) {

            if (err) {
                logger.error(err);
            } else {
                camInfo.snapshot = result.uri;
            }

            if (++returned === 3) {
                cb(camInfo);
            }
        });
    });
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
