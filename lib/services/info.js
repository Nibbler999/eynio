"use strict";

var conn;

var logger;

var externalIP = '';

var cfg = require('../configuration.js');

module.exports = function (c, l) {

    conn = c;
    logger = l.child({component: 'Info'});

    conn.on('setExternalIP', function (command) {
        setExternalIP.apply(command, command.args);
    });

    // Temp
    conn.on('setName', function (command) {
        setName.apply(command, command.args);
    });

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

    getLocation();
};

function getLocation()
{
    var latitude = cfg.get('latitude', null);
    var longitude = cfg.get('longitude', null);

    if (latitude === null || longitude === null) {

        conn.send('getLocation', function (loc) {
            if (loc && loc.longitude && loc.latitude) {
                configSet('latitude', loc.latitude);
                configSet('longitude', loc.longitude);
                logger.info('Set location automatically');
                sendServerLocation(loc.latitude, loc.longitude);
            }
        });

    } else {
        sendServerLocation(latitude, longitude);
    }
}

function setName(name)
{
    cfg.set('name', name);
}

function setExternalIP(ip)
{
    externalIP = ip;
}

function getServerStatus(cb)
{
    var name = cfg.get('name', '');

    var status = {
        name: name,
        ip: getIP(),
        external_ip: externalIP,
        version: getVersion(),
        updateable: getUpdateable(),
        node_version: process.version,
        node_arch: process.arch,
        node_platform: process.platform
    };

    conn.broadcast('serverStatus', status);

    if (cb) cb(status);
}

function sendServerLocation(latitude, longitude)
{
    conn.send('serverLocation', latitude, longitude);
}

function getVersion()
{
    delete require.cache[require.resolve('../../package.json')];
    return require('../../package.json').version;
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
    // systemd
    if (process.env.NHOME_CAN_UPDATE === '1') {
        return true;
    }

    // nw.js on windows
    if (process.platform === 'win32' && process.argv[0] === 'node') {
        return true;
    }

    // node update.js
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

    // nw.js on windows
    if (process.platform === 'win32' && process.argv[0] === 'node') {
        process.argv[0] = 'nhome.exe';
        reSpawnApp();
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
    var config = cfg.getAll();

    if (cb) cb(config);
}

function configRestore(newconfig, cb)
{
    cfg.setAll(newconfig);

    if (cb) cb();
}

function configSet(key, value, cb)
{
    cfg.set(key, value);

    if (cb) cb();
}

