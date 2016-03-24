"use strict";

var conn;

var logger;

var cfg = require('../configuration.js');

var http = require('http');
var url = require('url');

var Foscam = function (c, l) {

    conn = c;
    logger = l.child({component: 'Foscam'});

    conn.on('foscamMoveUp', function (command) {
        foscamMoveUp.apply(command, command.args);
    });

    conn.on('foscamMoveDown', function (command) {
        foscamMoveDown.apply(command, command.args);
    });

    conn.on('foscamMoveLeft', function (command) {
        foscamMoveLeft.apply(command, command.args);
    });

    conn.on('foscamMoveRight', function (command) {
        foscamMoveRight.apply(command, command.args);
    });

    conn.on('foscamZoomIn', function (command) {
        foscamZoomIn.apply(command, command.args);
    });

    conn.on('foscamZoomOut', function (command) {
        foscamZoomOut.apply(command, command.args);
    });
};

function foscamMoveUp(cameraid, cb)
{
    foscamCommand(cameraid, 'ptzMoveUp');

    setTimeout(function() {
        foscamCommand(cameraid, 'ptzStopRun', cb);
    }, 1000);
}

function foscamMoveDown(cameraid, cb)
{
    foscamCommand(cameraid, 'ptzMoveDown');

    setTimeout(function() {
        foscamCommand(cameraid, 'ptzStopRun', cb);
    }, 1000);
}

function foscamMoveLeft(cameraid, cb)
{
    foscamCommand(cameraid, 'ptzMoveLeft');

    setTimeout(function() {
        foscamCommand(cameraid, 'ptzStopRun', cb);
    }, 1000);
}

function foscamMoveRight(cameraid, cb)
{
    foscamCommand(cameraid, 'ptzMoveRight');

    setTimeout(function() {
        foscamCommand(cameraid, 'ptzStopRun', cb);
    }, 1000);
}

function foscamZoomIn(cameraid, cb)
{
    foscamCommand(cameraid, 'zoomIn');

    setTimeout(function() {
        foscamCommand(cameraid, 'zoomStop', cb);
    }, 1000);
}

function foscamZoomOut(cameraid, cb)
{
    foscamCommand(cameraid, 'zoomOut');

    setTimeout(function() {
        foscamCommand(cameraid, 'zoomStop', cb);
    }, 1000);
}

function foscamCommand(cameraid, cmd, cb)
{
    var cameras = cfg.get('cameras', {});

    var camera = cameras[cameraid];

    var parts = url.parse(camera.snapshot || camera.rtsp);

    var uri = 'http://' + parts.hostname + ':88/cgi-bin/CGIProxy.fcgi?cmd=' + cmd + '&usr=' + camera.auth_name + '&pwd=' + camera.auth_pass;

    http.get(uri, function (res) {

        res.resume();

        if (typeof cb === 'function') {
            cb(true);
        }
        
    }).on('error', function (err) {
        logger.error(err);
        if (typeof cb === 'function') {
            cb(false);
        }
    });
}

module.exports = Foscam;

