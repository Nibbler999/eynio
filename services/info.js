"use strict";

var conn;

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Info'});

    conn.on('getServerStatus', function (cb) {
       getServerStatus(cb);
    });
}

function getServerStatus(cb)
{
    var status = {
        ip: getIP(),
        version: getVersion()
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