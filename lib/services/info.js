"use strict";

var conn;

var logger;

var externalIP = '', serverPing = 0, platform;

var cfg = require('../configuration.js');
var updater = require('../updater.js');

var Info = function (c, l) {

    conn = c;
    logger = l.child({component: 'Info'});

    conn.on('setExternalIP', function (command) {
        setExternalIP.apply(command, command.args);
    });

    conn.on('setPing', function (ms) {
        serverPing = ms;
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

    conn.on('configBackup', function (command) {
        configBackup.apply(command, command.args);
    });

    conn.on('configRestore', function (command) {
        configRestore.apply(command, command.args);
    });

    conn.on('configSet', function (command) {
        configSet.apply(command, command.args);
    });

    conn.on('checkUpdates', function (command) {
        checkUpdates.apply(command, command.args);
    });

    conn.on('setBridgeAuth', function (command) {
        setBridgeAuth.apply(command, command.args);
    });

    getLocation();

    getPlatform(sendServerInfo);

    autoUpdate();
};

function setBridgeAuth(bridge, auth, cb)
{
    cfg.set('auth:' + bridge, auth, cb);
}

function autoUpdate()
{
    if (!getUpdateable()) {
        return;
    }

    setInterval(function () {

        if (!cfg.get('autoUpdate', false)) {
            return;
        }

        updater.get(function (available) {

            if (available) {
                updateApp();
            }
        });

    }, 60 * 60 * 1000);
}

function getPlatform(cb)
{
    platform = process.platform;

    var platformCLI = process.argv.indexOf('--platform');

    if (platformCLI !== -1) {

        platform = process.argv[platformCLI + 1];

        cb();

    } else if (process.platform === 'win32') {

        platform = getWindowsVersion();

        cb();

    } else if (process.platform === 'linux') {

        getLinuxDistro(cb);
    }
}

function getWindowsVersion()
{
    var os = require('os');

    var nameMap = {
        '10.0': '10',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7',
        '6.0': 'Vista',
        '5.1': 'XP',
        '5.0': '2000',
        '4.9': 'ME',
        '4.1': '98',
        '4.0': '95'
    };

    var verRe = /\d+\.\d+/;
    var version = verRe.exec(os.release());

    return 'Windows ' + nameMap[(version || [])[0]];
}

function getLinuxDistro(cb)
{
    var fs = require('fs');

    fs.readFile('/etc/os-release', { encoding: 'utf8' }, function (err, data) {

        if (err) {
            logger.error(err);
            cb();
            return;
        }

        var lines = data.split('\n');

        var values = {};

        lines.forEach(function (line) {

            var matches = line.match(/^(.+)="?(.+?)"?$/);

            if (matches) {
                values[matches[1]] = matches[2];
            }
        });

        if (values.NAME) {

            platform = values.NAME;

            if (values.VERSION_ID) {
                platform += ' ' + values.VERSION_ID;
            }
        }

        cb();
    });
}

function sendServerInfo()
{
    var info = {
        ip: getIP(),
        version: getVersion(),
        node_version: process.version,
        node_arch: process.arch,
        node_platform: platform
    };

    conn.send('serverInfo', info);
}

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

function setExternalIP(ip)
{
    externalIP = ip;
}

function onExternalIP(cb)
{
    conn.once('setExternalIP', function (command) {
        cb(command.args[0]);
    });
}

function getServerStatus(cb)
{
    var name = cfg.get('name', '');
    var latitude = cfg.get('latitude', null);
    var longitude = cfg.get('longitude', null);
    var quota = cfg.get('recordingQuota', 100);
    var autoUpdate = cfg.get('autoUpdate', false);
    var regdate = cfg.get('regdate', '');

    var local = (this.ip === externalIP);

    var status = {
        name: name,
        ip: getIP(),
        external_ip: externalIP,
        version: getVersion(),
        updateable: getUpdateable(),
        node_version: process.version,
        node_arch: process.arch,
        node_platform: platform,
        ping: serverPing,
        latitude: latitude,
        longitude: longitude,
        local: local,
        recording_quota: quota,
        autoupdate: autoUpdate,
        regdate: regdate
    };

    if (typeof cb === 'function') {
        cb(status);
    }
}

function sendServerLocation(latitude, longitude)
{
    conn.send('serverLocation', latitude, longitude);
}

function getVersion()
{
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

function getUpdateable()
{
    return process.env.NHOME_CAN_UPDATE === '1';
}

function updateApp(cb)
{
    if (!getUpdateable()) {

        logger.warn('Unable to handle updateApp request');

        if (typeof cb === 'function') {
            cb(false);
        }

        return false;
    }

    if (typeof cb === 'function') {
        cb(true);
    }

    process.exit();
}

function ping(cb)
{
    if (typeof cb === 'function') {
        cb();
    }
}

function configBackup(cb)
{
    var config = cfg.getAll();

    if (typeof cb === 'function') {
        cb(config);
    }
}

function configRestore(newconfig, cb)
{
    // Check config file is valid
    if (!(newconfig && newconfig.serverid && newconfig.uuid)) {
        if (typeof cb === 'function') {
            cb(false);
        }
        return false;
    }

    // Remove server identity, just keep settings
    delete newconfig.serverid;
    delete newconfig.uuid;

    // Update server name
    conn.send('setName', newconfig.name);

    cfg.setMulti(newconfig, cb);
}

function configSet(key, value, cb)
{
    if (['name', 'latitude', 'longitude', 'recordingQuota', 'autoUpdate'].indexOf(key) === -1) {

        if (typeof cb === 'function') {
            cb(false);
        }

        return false;
    }

    if (key === 'name') {
        conn.send('setName', value);
    }

    if (key === 'latitude' || key === 'longitude') {
        value = parseFloat(value).toFixed(4);
    }

    cfg.set(key, value, cb);
}

function checkUpdates(cb)
{
    updater.get(function (update) {
        cb(update ? true : false);
    });
}

Info.getServerStatus = getServerStatus;
Info.onExternalIP = onExternalIP;

module.exports = Info;

