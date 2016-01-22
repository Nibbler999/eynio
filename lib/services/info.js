"use strict";

var conn;

var logger, actionlogger;

var externalIP = '', serverPing = 0;

var cfg = require('../configuration.js');

module.exports = function (c, l) {

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

    conn.on('log', function (command) {
        formattedLog.apply(command, command.args);
    });

    conn.on('getLog', function (command) {
        getLog.apply(command, command.args);
    });

    conn.on('appendActionLog', function (command) {
        appendActionLog.apply(command, command.args);
    });

    conn.on('getActionLog', function (command) {
        getActionLog.apply(command, command.args);
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

    getLocation();

    sendServerInfo();

    createActionLogger();
};

function sendServerInfo()
{
    var info = {
        ip: getIP(),
        version: getVersion(),
        node_version: process.version,
        node_arch: process.arch,
        node_platform: process.platform
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

function getActionLogFile()
{
    var home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

    var filename = 'nhome-action.log';

    if (require('os').type() === 'Linux') {
        filename = '.' + filename;
    }

    var filepath = require('path').join(home, filename);

    return filepath;
}

function createActionLogger()
{
    var fs = require('fs');
    var bunyan = require('bunyan');

    var actionLogFile = getActionLogFile();

    var maxEntries = 100;

    var ringbuffer = new bunyan.RingBuffer({ limit: maxEntries });

    try {

        var actionLog = fs.readFileSync(actionLogFile, { encoding: 'utf8' }).trim().split('\n');

        if (actionLog.length > maxEntries) {
            actionLog = actionLog.slice(-maxEntries);
        }

        actionLog.forEach(function (line) {
            if (!line) {
                return;
            }
            try {
                var record = JSON.parse(line);
                ringbuffer.write(record);
            } catch (e) {
                console.log('Failed to parse actionlog line', line);
            }
        });

        if (actionLog[0]) {
            fs.writeFileSync(actionLogFile, actionLog.join('\n') + '\n');
        }

    } catch (e) { /* log file does not exist */ }

    actionlogger = bunyan.createLogger({
        name: 'NHome',
        streams: [{
            type: 'raw',
            stream: ringbuffer
        }, {
            path: actionLogFile
        }]
    });
}

function setExternalIP(ip)
{
    externalIP = ip;
}

function getServerStatus(cb)
{
    var name = cfg.get('name', '');
    var latitude = cfg.get('latitude', null);
    var longitude = cfg.get('longitude', null);

    var local = (this.ip === externalIP);

    var status = {
        name: name,
        ip: getIP(),
        external_ip: externalIP,
        version: getVersion(),
        updateable: getUpdateable(),
        node_version: process.version,
        node_arch: process.arch,
        node_platform: process.platform,
        ping: serverPing,
        latitude: latitude,
        longitude: longitude,
        local: local
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

function formattedLog(cb)
{
    var PrettyStream = require('bunyan-prettystream');

    var prettyLog = new PrettyStream({mode: 'short', useColor: false});

    var ringbuffer = logger.streams[1].stream;

    var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');

    conn.broadcast('log', entries);

    if (typeof cb === 'function') {
        cb(entries);
    }
}

function getLog(cb)
{
    var ringbuffer = logger.streams[1].stream;

    var entries = ringbuffer.records.map(formatDateAsTimestamp);

    if (typeof cb === 'function') {
        cb(entries);
    }
}

function formatDateAsTimestamp(entry)
{
    var newEntry = JSON.parse(JSON.stringify(entry));

    newEntry.time = Math.round(new Date(newEntry.time).getTime() / 1000);

    return newEntry;
}

function formatDateAsMillisecondTimestamp(entry)
{
    var newEntry = JSON.parse(JSON.stringify(entry));

    newEntry.time = new Date(newEntry.time).getTime();

    return newEntry;
}

function getActionLog(cb)
{
    var ringbuffer = actionlogger.streams[0].stream;

    var entries = ringbuffer.records.map(formatDateAsMillisecondTimestamp);

    if (typeof cb === 'function') {
        cb(entries);
    }
}

function appendActionLog(entry)
{
    actionlogger.info({entry: entry});
}

function getUpdateable()
{
    // systemd
    if (process.env.NHOME_CAN_UPDATE === '1') {
        return true;
    }

    // nw.js on windows
    if (process.platform === 'win32' && process.versions['nw']) {
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
    if (typeof cb === 'function') {
        cb();
    }

    // Our NHome pi image - systemd will update app and respawn us
    if (process.env.NHOME_CAN_UPDATE === '1') {
        process.exit();
        return;
    }

    // nw.js on windows
    if (process.platform === 'win32' && process.versions['nw']) {
        spawnUpdater();
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

function spawnUpdater()
{
    var cp_opt = {
        detached: true
    };

    require('child_process').spawn('node', ['update.js', process.pid], cp_opt);
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
    cfg.setAll(newconfig);

    if (typeof cb === 'function') {
        cb();
    }
}

function configSet(key, value, cb)
{
    if (['name', 'latitude', 'longitude', 'disableLocalMode', 'recordingQuota'].indexOf(key) === -1) {

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

    cfg.set(key, value);

    if (typeof cb === 'function') {
        cb(true);
    }
}

function checkUpdates(cb)
{
    var version = getVersion();

    var https = require('https');

    https.get('https://neosoft-updates.s3.amazonaws.com/zupdate/NHomeServer/' + version + '.xml', function(res) {

        var updateXML = '';

        res.on('data', function(d) {
            updateXML += d;
        });

        res.on('end', function() {
            if (res.statusCode === 200) {

                require('xml2js').parseString(updateXML, function (err, info) {

                    if (err) {
                        logger.error(err);
                        return cb(false);
                    }

                    logger.debug('Updates', info.updates);

                    cb(info.updates ? true : false);
                });
            } else {
                logger.error('Updates', res.statusCode);
                cb(false);
            }
        });

    }).on('error', function(e) {
        logger.error('Updates', e);
        cb(false);
    });
}

