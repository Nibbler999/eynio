"use strict";

var conn;

var logger;

var cfg = require('../configuration.js');
var _ = require('lodash');

var blacklister = function (c, l) {

    conn = c;
    logger = l.child({component: 'Blacklist'});

    conn.on('blacklistDevice', function (command) {
        blacklistDevice.apply(command, command.args);
    });

    conn.on('unblacklistDevice', function (command) {
        unblacklistDevice.apply(command, command.args);
    });

    conn.on('blacklistBridge', function (command) {
        blacklistBridge.apply(command, command.args);
    });

    conn.on('unblacklistBridge', function (command) {
        unblacklistBridge.apply(command, command.args);
    });

    conn.on('blacklistModule', function (command) {
        blacklistModule.apply(command, command.args);
    });

    conn.on('unblacklistModule', function (command) {
        unblacklistModule.apply(command, command.args);
    });

    conn.on('getBlacklist', function (command) {
        getBlacklist.apply(command, command.args);
    });
};

function getBlacklist(type, cb)
{
    var cfg_var = 'blacklist_' + type;

    var blacklist = cfg.get(cfg_var, []);

    if (typeof cb === 'function') {
        cb(blacklist);
    }
}

function blacklistDevice(device, cb)
{
    blacklist_add('devices', device, cb);
}

function unblacklistDevice(device, cb)
{
    blacklist_remove('devices', device, cb);
}

function blacklistBridge(bridge, cb)
{
    blacklist_add('bridges', bridge, cb);
}

function unblacklistBridge(bridge, cb)
{
    blacklist_remove('bridges', bridge, cb);
}

function blacklistModule(module, cb)
{
    blacklist_add('modules', module, cb);
}

function unblacklistModule(module, cb)
{
    blacklist_remove('modules', module, cb);
}

function blacklist_add(type, element, cb)
{
    var cfg_var = 'blacklist_' + type;

    var blacklist = cfg.get(cfg_var, []);

    if (!_.contains(blacklist, element)) {

        blacklist.push(element);

        cfg.set(cfg_var, blacklist);

        conn.broadcast('deviceBlacklisted', type, element);

        logger.debug('Added', type, element, 'to blacklist');

        if (typeof cb === 'function') {
            cb(true);
        }

    } else {
        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

function blacklist_remove(type, element, cb)
{
    var cfg_var = 'blacklist_' + type;

    var blacklist = cfg.get(cfg_var, []);

    if (_.contains(blacklist, element)) {

        blacklist = _.without(blacklist, element);

        cfg.set(cfg_var, blacklist);
    }

    if (typeof cb === 'function') {
        cb(true);
    }

    logger.debug('Removed', type, element, 'from blacklist');
}

module.exports = blacklister;

