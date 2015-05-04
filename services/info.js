"use strict";

var conn;

var logger;

module.exports = function (c, l) {

    conn = c;
    logger = l.child({component: 'Info'});

    conn.on('getServerStatus', function (command) {
        getServerStatus.apply(command, command.args);
    });

    conn.on('updateApp', function (command) {
        updateApp.apply(command, command.args);
    });

    conn.on('ping', function (command) {
        ping.apply(command, command.args);
    });

    conn.on('log', function (command) {
        getLog.apply(command, command.args);
    });

    conn.on('configBackup', function (command) {
        configBackup.apply(command, command.args);
    });

    conn.on('configRestore', function (command) {
        configRestore.apply(command, command.args);
    });

    conn.on('configSet', function (command) {
        configSet.apply(command, command.args);
    });
};

function getServerStatus(cb)
{
    var status = {
        ip: getIP(),
        version: getVersion(),
        updateable: getUpdateable()
    };

    conn.broadcast('serverStatus', status);

    if (cb) cb(status);
}

function getVersion()
{
    delete require.cache[require.resolve('../package.json')];
    return require('../package.json').version;
}

function getIP()
{
    var interfaces = require('os').networkInterfaces();

    var addresses = [];

    for (var i in interfaces) {

        for (var j = 0; j < interfaces[i].length; j++) {

            if (interfaces[i][j].internal) {
                continue;
            }

            if (interfaces[i][j].family === 'IPv6' && interfaces[i][j].address.substr(0, 4) === 'fe80') {
                continue;
            }

            if (interfaces[i][j].family === 'IPv6' && interfaces[i][j].address.substr(0, 4) === '2001') {
                continue;
            }

            addresses.push(interfaces[i][j].address);
        }
    }

    return addresses.join(', ');
}

function getLog(cb)
{
    var PrettyStream = require('bunyan-prettystream');

    var prettyLog = new PrettyStream({mode: 'short', useColor: false});

    var ringbuffer = logger.streams[1].stream;

    var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');

    conn.broadcast('log', entries);

    if (cb) cb(entries);
}

function getUpdateable()
{
    if (process.env.NHOME_CAN_UPDATE === '1') {
        return true;
    }

    if (require('path').basename(process.argv[1], '.js') === 'update') {
        return true;
    }

    return false;
}

function updateApp(cb)
{
    if (cb) cb();

    // Our NHome pi image - systemd will update app and respawn us
    if (process.env.NHOME_CAN_UPDATE === '1') {
        process.exit();
        return;
    }

    // restarting app runs update.js again
    if (require('path').basename(process.argv[1], '.js') === 'update') {
        reSpawnApp();
        return;
    }

    logger.warn('Unable to handle updateApp request');
}

function reSpawnApp()
{
    var args = ['/s', '/c'].concat(process.argv);

    var cp_opt = {
        detached: true
    };

    require('child_process').spawn('cmd', args, cp_opt);

    process.exit();
}

function ping(cb)
{
    if (cb) cb();
}

function configBackup(cb)
{
    var cfg = require('../configuration.js');
    var config = cfg.getAll();

    if (cb) cb(config);
}

function configRestore(newconfig, cb)
{
    var cfg = require('../configuration.js');

    cfg.setAll(newconfig);

    if (cb) cb();
}

function configSet(key, value, cb)
{
    var cfg = require('../configuration.js');

    cfg.set(key, value);

    if (cb) cb(config);
}

