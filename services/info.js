
var conn;

function log(msg)
{
    console.log('[Info]', msg);
}

module.exports = function(c) {

    conn = c;

    conn.on('getServerStatus', function () {
        getServerStatus();
    });
}

function getServerStatus(status)
{
    var status = {
        ip: getIP(),
        version: getVersion()
    };

    conn.emit('serverStatus', status);
}

function getVersion()
{
    return require('../package.json').version;
}

function getIP()
{
    var interfaces = require('os').networkInterfaces();

    var addresses = [];

    for (i in interfaces) {

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