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
    logger.info('Creating proxy to ' + proxy.host + ':' + proxy.port);
    
    var ext = require('net').connect(proxy.port, proxy.host, function() {
    
        ext.write(proxy.request);
    
        require('tls').connect({host: 'nhome.ba', port: 8082}, function() {

            this.setNoDelay();

            this.write(proxy.id);

            ext.pipe(this).pipe(ext);
    
            this.on('error', function(err) {
                logger.trace(err);
                ext.end();
                ext.destroy();
            });
    
            this.on('close', function() {
                logger.trace('Client close');
                ext.end();
                ext.destroy();
            });
        });
    });

    ext.on('error', function(err) {
       logger.trace(err);
    });
    
    ext.on('close', function() {
        logger.trace('Server close');
    });
}
