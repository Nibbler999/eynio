"use strict";

var conn;

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Proxy'});

    conn.on('proxyConnect', function (proxy) {
        proxyConnect(proxy);
    });
};

function proxyConnect(proxy)
{
    logger.debug('Creating proxy to ' + proxy.host + ':' + proxy.port);
    
    var child = require('child_process').fork(__dirname + '/proxy-child.js');

    child.on('message', function(message) {
        logger.error(proxy.host + ':' + proxy.port, message);
    });

    child.send(proxy);
}
