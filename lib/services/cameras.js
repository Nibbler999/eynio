"use strict";

var url = require('url');
var tcpp = require('tcp-ping');
var deepExtend = require('deep-extend');

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var conn, logger, cameras = {};

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

    conn.on('moveCamera', function (command) {
        moveCameraAbsolute.apply(command, command.args);
    });

    conn.on('moveCameraAbsolute', function (command) {
        moveCameraAbsolute.apply(command, command.args);
    });

    conn.on('moveCameraRelative', function (command) {
        moveCameraRelative.apply(command, command.args);
    });

    conn.on('supportsPTZ', function (command) {
        supportsPTZ.apply(command, command.args);
    });

    conn.on('getPTZ', function (command) {
        getPTZ.apply(command, command.args);
    });
};

function getCameras(cb)
{
    var cam_array = hash_to_array(cameras);

    require('../common.js').addDeviceProperties.call(this, cam_array);

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

    if (typeof cb === 'function') {
        cb(cam_array);
    }
}

function deleteCamera(cameraid, cb)
{
    delete cameras[cameraid];

    conn.broadcast('cameraDeleted', cameraid);

    logger.debug('Camera', cameraid, 'deleted');

    cfg.set('cameras', cameras, cb);
}

function updateCamera(camera, cb)
{
    for (var prop in camera) {
        cameras[camera.id][prop] = camera[prop];
    }

    conn.broadcast('cameraUpdated', cameras[camera.id]);

    logger.debug('Camera', camera.id, 'updated');

    cfg.set('cameras', cameras, cb);
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
    if (!camera.name) {
        logger.error('No camera name provided');
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    if (!(camera.mjpeg || camera.snapshot || camera.rtsp || camera.local || camera.screencapture)) {
        logger.error('No valid camera source provided');
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    camera.id = require('uuid/v4')();

    cameras[camera.id] = camera;

    logger.debug('Camera', camera.id, 'added');

    var cam = {};

    deepExtend(cam, camera, { type: 'camera', categories: [] });

    conn.broadcast('cameraAdded', cam);

    cfg.set('cameras', cameras, cb);
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

        cams.filter(function (cam) {
            return !alreadyAdded(cam.hostname);
        }).forEach(function (cam) {
            results.push(cam.hostname + ':' + cam.port);
        });

        if (typeof cb === 'function') {
            cb(results);
        }
    });
}

function alreadyAdded(hostname)
{
    var parts, path;

    for (var id in cameras) {

        path = cameras[id].snapshot || cameras[id].rtsp;

        if (!path) {
            continue;
        }

        parts = url.parse(path);

        if (parts && parts.hostname === hostname) {
            return true;
        }
    }

    return false;
}

function checkOnline(hostname, port, cb)
{
    tcpp.ping({address: hostname, port: port, attempts: 1, timeout: 2000 }, function (err, data) {

        if (data.min === undefined) {
            logger.warn(hostname + ':' + port, 'not responding to tcp connection');
            logger.debug('tcpp error', err);
            return cb(false);
        }

        cb(true);
    });
}

function scanCamera(id, username, password, cb)
{
    var hostname = id.split(':')[0];
    var port = id.split(':')[1];

    checkOnline(hostname, port, function (online) {

        if (!online) {
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

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
                auth_name: username,
                auth_pass: password,
                onvif: port
            };

            camera.getDeviceInformation(function (err, result) {

                if (err) {
                    logger.error(err);
                } else {
                    camInfo.manufacturer = result.manufacturer;
                    camInfo.model = result.model;
                    camInfo.name = result.manufacturer + ' ' + result.model;
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
    });
}

function moveCameraAbsolute(cameraid, x, y, zoom, cb)
{
    var camera = cameras[cameraid];

    if (!camera.onvif) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var parts = url.parse(camera.snapshot || camera.rtsp);

    checkOnline(parts.hostname, camera.onvif, function (online) {

        if (!online) {
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var Cam = require('onvif').Cam;

        var c = new Cam({
            hostname: parts.hostname,
            port: camera.onvif,
            username: camera.auth_name,
            password: camera.auth_pass
        }, function (err) {

            if (err) {
                logger.error(err);
                if (typeof cb === 'function') {
                    cb(false);
                }
                return;
            }

            if (x === null || y === null) {
                x = y = undefined;
            }

            if (zoom === null) {
                zoom = undefined;
            }

            c.absoluteMove({x: x, y: y, zoom: zoom});

            if (typeof cb === 'function') {
                cb(true);
            }
        });
    });
}

function moveCameraRelative(cameraid, x, y, zoom, cb)
{
    var camera = cameras[cameraid];

    if (!camera.onvif) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var parts = url.parse(camera.snapshot || camera.rtsp);

    checkOnline(parts.hostname, camera.onvif, function (online) {

        if (!online) {
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var Cam = require('onvif').Cam;

        var c = new Cam({
            hostname: parts.hostname,
            port: camera.onvif,
            username: camera.auth_name,
            password: camera.auth_pass
        }, function (err) {

            if (err) {
                logger.error(err);
                if (typeof cb === 'function') {
                    cb(false);
                }
                return;
            }

            c.relativeMove({x: x, y: y, zoom: zoom});

            if (typeof cb === 'function') {
                cb(true);
            }
        });
    });
}

function getPTZ(cameraid, cb)
{
    var camera = cameras[cameraid];

    if (!camera.onvif) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var parts = url.parse(camera.snapshot || camera.rtsp);

    checkOnline(parts.hostname, camera.onvif, function (online) {

        if (!online) {
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var Cam = require('onvif').Cam;

        var c = new Cam({
            hostname: parts.hostname,
            port: camera.onvif,
            username: camera.auth_name,
            password: camera.auth_pass
        }, function (err) {

            if (err) {
                logger.error(err);
                if (typeof cb === 'function') {
                    cb(false);
                }
                return;
            }

            c.getStatus(function (err, status) {

                if (err) {
                    logger.error(err);
                    if (typeof cb === 'function') {
                        cb(false);
                    }
                    return;
                }

                if (typeof cb === 'function') {
                    cb(status.position);
                }
            });
        });
    });
}

function supportsPTZ(cameraid, cb)
{
    var camera = cameras[cameraid];

    if (!camera.onvif) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var parts = url.parse(camera.snapshot || camera.rtsp);

    checkOnline(parts.hostname, camera.onvif, function (online) {

        if (!online) {
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        var Cam = require('onvif').Cam;

        var c = new Cam({
            hostname: parts.hostname,
            port: camera.onvif,
            username: camera.auth_name,
            password: camera.auth_pass
        }, function (err) {

            if (err) {
                logger.error(err);
                if (typeof cb === 'function') {
                    cb(false);
                }
                return;
            }

            if (typeof cb === 'function') {
                cb(c.capabilities.PTZ ? true : false);
            }
        });
    });
}

module.exports = Cams;
