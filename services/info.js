"use strict";

var conn;

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Info'});

    conn.on('getServerStatus', function (cb) {
       getServerStatus(cb);
    });

    conn.on('updateApp', function() {
        updateApp();        
    });
};

function getServerStatus(cb)
{
    var status = {
        ip: getIP(),
        version: getVersion(),
        updateable: getUpdateable()
    };

    conn.emit('serverStatus', status);

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

            if (interfaces[i][j].family == 'IPv6' && interfaces[i][j].address.substr(0, 4) == 'fe80') {
                continue;
            }

            if (interfaces[i][j].family == 'IPv6' && interfaces[i][j].address.substr(0, 4) == '2001') {
                continue;
            }

            addresses.push(interfaces[i][j].address);
        }
    }

    return addresses.join(', ');
}

function getUpdateable()
{
    if (process.env['NHOME_CAN_UPDATE'] === '1') {
        return true;
    }

    if (process.platform === 'win32') {
        return true;
    }

    return false;
}

function updateApp()
{
    // Our NHome pi image - systemd will update app and respawn us 
    if (process.env['NHOME_CAN_UPDATE'] === '1') {
        process.exit();
        return;
    }

    // Windows - restarting app runs update.js again
    if (process.platform === 'win32') {
        reSpawnApp();
        return;
    }

    logger.warn('Unable to handle updateApp request');
}

function reSpawnApp()
{
    var args = [].concat(process.argv);

    args.shift();

    var cp_opt = {
        stdio: 'inherit',
        cwd: process.cwd(),
        detached: true
    };

    require('child_process').spawn(process.execPath, args, cp_opt);

    process.exit();
}
