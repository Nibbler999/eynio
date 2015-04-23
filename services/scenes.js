"use strict";

var conn;
var scenes = {};

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Scenes'});

    var cfg = require('../configuration.js');
    scenes = cfg.get('scenes', {});

    conn.on('addScene', function (command) {
        addScene.apply(command, command.args);
    });

    conn.on('updateScene', function (command) {
        updateScene.apply(command, command.args);
    });

    conn.on('deleteScene', function (command) {
        deleteScene.apply(command, command.args);
    });

    conn.on('getScenes', function (command) {
        getScenes.apply(command, command.args);
    });

    conn.on('setScene', function (command) {
        setScene.apply(command, command.args);
    });
};

function addScene(scene, cb)
{
    scene.id = require('node-uuid').v4();

    scenes[scene.id] = scene;

    save();

    if (cb) cb(scenes);
}

function updateScene(scene, cb)
{
    for (var prop in scene) {
        scenes[scene.id][prop] = scene[prop];
    }

    save();

    if (cb) cb(scenes[scene.id]);
}

function deleteScene(sceneid, cb)
{
    delete scenes[sceneid];

    save();

    if (cb) cb();
}

function getScenes(cb)
{
    if (cb) cb(scenes);
}

function setScene(sceneid, cb)
{
    var scene = scenes[sceneid];

    if (!scene) {
        if (cb) cb(false);
        return;
    }

    scene.actions.forEach(function (action) {
        var params = [action.emit];
        params = params.concat(action.params);
        conn.emit.apply(conn, params);
    });

    if (cb) cb(true);
}

function save()
{
    var cfg = require('../configuration.js');

    cfg.set('scenes', scenes);
}

