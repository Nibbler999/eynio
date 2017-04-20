"use strict";

var conn;
var scenes = {};

var logger;

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;
var invert = require('../common.js').invert_action;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Scenes'});

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

    conn.on('cancelScene', function (command) {
        cancelScene.apply(command, command.args);
    });
};

function addScene(scene, cb)
{
    scene.id = require('uuid/v4')();

    scenes[scene.id] = scene;

    scene.active = false;

    cfg.set('scenes', scenes);

    logger.debug('Scene', scene.id, 'added');

    conn.broadcast('sceneAdded', scene);

    if (typeof cb === 'function') {
        cb(scene.id);
    }
}

function updateScene(scene, cb)
{
    for (var prop in scene) {
        scenes[scene.id][prop] = scene[prop];
    }

    cfg.set('scenes', scenes);

    logger.debug('Scene', scene.id, 'updated');

    if (typeof cb === 'function') {
        cb(scenes[scene.id]);
    }
}

function deleteScene(sceneid, cb)
{
    delete scenes[sceneid];

    logger.debug('Scene', sceneid, 'deleted');

    conn.broadcast('sceneDeleted', sceneid);

    cfg.set('scenes', scenes, cb);
}

function getScenes(cb)
{
    var scene_array = hash_to_array(scenes);

    require('../common.js').addDeviceProperties.call(this, scene_array);

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
        user_name: this.user_name,
        user_id: this.user_id,
        id: sceneid,
        device: scene.name,
        action: 'scene-set'
    };

    conn.emit('appendActionLog', scene_entry);

    scene.actions.forEach(function (action) {

        var command = {
            name: action.emit_name,
            args: action.params
        };

        command.log = function (deviceid, devicename, action) {

            var entry = {
                user_name: scene.name,
                id: deviceid,
                device: devicename,
                action: action
            };

            conn.emit('appendActionLog', entry);
        };

        conn.emit(command.name, command);
    });

    scene.active = true;

    cfg.set('scenes', scenes);

    logger.debug('Scene', sceneid, 'set');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function cancelScene(sceneid, cb)
{
    var scene = scenes[sceneid];

    if (!scene) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return;
    }

    var scene_entry = {
        user_name: this.user_name,
        user_id: this.user_id,
        id: sceneid,
        device: scene.name,
        action: 'scene-cancel'
    };

    conn.emit('appendActionLog', scene_entry);

    scene.actions.forEach(function (action) {

        var inverted = invert(action);

        var command = {
            name: inverted.emit_name,
            args: inverted.params
        };

        command.log = function (deviceid, devicename, action) {

            var entry = {
                user_name: scene.name,
                id: deviceid,
                device: devicename,
                action: action
            };

            conn.emit('appendActionLog', entry);
        };

        conn.emit(command.name, command);
    });

    scene.active = false;

    cfg.set('scenes', scenes);

    logger.debug('Scene', sceneid, 'cancelled');

    if (typeof cb === 'function') {
        cb(true);
    }
}

