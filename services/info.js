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

    conn.on('ping', function (cb) {
        if (cb) cb();
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
    if (process.env.NHOME_CAN_UPDATE === '1') {
        return true;
    }

    if (require('path').basename(process.argv[1], '.js') === 'update') {
        return true;
    }

    return false;
}

function updateApp()
{
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
