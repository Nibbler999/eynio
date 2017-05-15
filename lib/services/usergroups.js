"use strict";

var conn;

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var includes = require('lodash/includes');
var without = require('lodash/without');

var groups;

var Usergroups = function (c) {

    conn = c;

    groups = cfg.get('usergroups', {});

    conn.on('addUsergroup', function (command) {
        addUsergroup.apply(command, command.args);
    });

    conn.on('deleteUsergroup', function (command) {
        deleteUsergroup.apply(command, command.args);
    });

    conn.on('getUsergroups', function (command) {
        getUsergroups.apply(command, command.args);
    });

    conn.on('addUsergroupMember', function (command) {
        addUsergroupMember.apply(command, command.args);
    });

    conn.on('removeUsergroupMember', function (command) {
        removeUsergroupMember.apply(command, command.args);
    });

    conn.on('addUsergroupDevice', function (command) {
        addUsergroupDevice.apply(command, command.args);
    });

    conn.on('removeUsergroupDevice', function (command) {
        removeUsergroupDevice.apply(command, command.args);
    });

    conn.on('getMyUsergroup', function (command) {
        getMyUsergroup.apply(command, command.args);
    });
};

function addUsergroup(name, cb)
{
    var id = require('uuid/v4')();

    var group = {
        id: id,
        name: name,
        members: [],
        devices: []
    };

    groups[id] = group;

    cfg.set('usergroups', groups);

    if (typeof cb === 'function') {
        cb(id);
    }
}

function deleteUsergroup (groupid, cb)
{
    delete groups[groupid];

    cfg.set('usergroups', groups, cb);
}

function getUsergroups (cb)
{
    var groups_array = hash_to_array(groups);

    if (typeof cb === 'function') {
        cb(groups_array);
    }
}

function addUsergroupMember (groupid, email, cb)
{
    var group = groups[groupid];

    if (!includes(group.members, email)) {

        group.members.push(email);

        return cfg.set('usergroups', groups, cb);
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeUsergroupMember (groupid, email, cb)
{
    var group = groups[groupid];

    group.members = without(group.members, email);

    cfg.set('usergroups', groups, cb);
}

function addUsergroupDevice (groupid, deviceid, cb)
{
    var group = groups[groupid];

    if (!includes(group.devices, deviceid)) {

        group.devices.push(deviceid);

        return cfg.set('usergroups', groups, cb);
    }

    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeUsergroupDevice (groupid, deviceid, cb)
{
    var group = groups[groupid];

    group.devices = without(group.devices, deviceid);

    cfg.set('usergroups', groups, cb);
}

function getMyUsergroup (cb)
{
    var usergroup = null;

    for (var id in groups) {
        if (groups[id].members.indexOf(this.user_email) !== -1) {
            usergroup = groups[id];
            break;
        }
    }

    if (typeof cb === 'function') {
        cb(usergroup);
    }
}

module.exports = Usergroups;

