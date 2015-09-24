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

    logger.debug('Scene', scene.id, 'added');

    conn.broadcast('sceneAdded', scene);

    var scene_array = hash_to_array(scenes);

    if (typeof cb === 'function') {
        cb(scene_array);
    }
}

function updateScene(scene, cb)
{
    for (var prop in scene) {
        scenes[scene.id][prop] = scene[prop];
    }

    save();

    logger.debug('Scene', scene.id, 'updated');

    if (typeof cb === 'function') {
        cb(scenes[scene.id]);
    }
}

function deleteScene(sceneid, cb)
{
    delete scenes[sceneid];

    save();

    logger.debug('Scene', sceneid, 'deleted');

    if (typeof cb === 'function') {
        cb();
    }
}

function getScenes(cb)
{
    var scene_array = hash_to_array(scenes);

    if (typeof cb === 'function') {
        cb(scene_array);
    }
}

function setScene(sceneid, cb)
{
    var scene = scenes[sceneid];

    if (!scene) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var scene_entry = {
        user: this.user,
        id: sceneid,
        device: scene.name,
        action: 'scene-set'
    };

    conn.send('appendActionLog', scene_entry);

    scene.actions.forEach(function (action) {

        var command = {
            name: action.emit,
            args: action.params
        };

        command.log = function (deviceid, devicename, action) {

            var entry = {
                user: scene.name,
                id: deviceid,
                device: devicename,
                action: action
            };

            conn.send('appendActionLog', entry);
        };

        conn.emit(command.name, command);
    });

    logger.debug('Scene', sceneid, 'set');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function save()
{
    var cfg = require('../configuration.js');

    cfg.set('scenes', scenes);
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

