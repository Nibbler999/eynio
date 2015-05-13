"use strict";

var conn;

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Proxy'});

    conn.on('proxyConnect', function (command) {
        proxyConnect.apply(command, command.args);
    });
};

function proxyConnect(proxy)
{
    logger.debug('Creating proxy to ' + proxy.host + ':' + proxy.port);

    var numcores = require('os').cpus().length;

    if (numcores > 1) {

        var child_path = require('path').join(__dirname, '/proxy-child.js');

        var child = require('child_process').fork(child_path);

        child.on('message', function(message) {
            logger.error(proxy.host + ':' + proxy.port, message);
        });

        child.send(proxy);

    } else {

        var ext = require('net').connect(proxy.port, proxy.host, function() {

            ext.write(proxy.request);

            require('tls').connect({host: 'nhome.ba', servername: 'nhome.ba', port: 8082}, function() {

                this.setNoDelay();

                this.write(proxy.id);

                ext.pipe(this).pipe(ext);

                this.on('error', function(err) {
                    logger.error(proxy.host + ':' + proxy.port, err.message);
                    ext.end();
                    ext.destroy();
                });

                this.on('close', function() {
                    ext.end();
                    ext.destroy();
                });
            });
        });

        ext.on('error', function(err) {
            logger.error(proxy.host + ':' + proxy.port, err.message);
        });
    }
}
