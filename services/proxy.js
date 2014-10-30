
var conn;

function log(msg)
{
    console.log('[Proxy]', msg);
}

module.exports = function(c) {

    conn = c;

    conn.on('proxyConnect', function (proxy) {
        proxyConnect(proxy);
    });
}

function proxyConnect(proxy)
{
    log('Creating proxy to ' + proxy.host + ':' + proxy.port);
    
    var ext = require('net').connect(proxy.port, proxy.host, function() {
    
        ext.write(proxy.request);
    
        require('tls').connect({host: 'nhome.neosoft.ba', port: 8082}, function() {

            this.setNoDelay();

            this.write(proxy.id);

            ext.pipe(this).pipe(ext);
    
            this.on('error', function(err) {
                log('Client error: ' + err);
                ext.end();
                ext.destroy();
            });
    
            this.on('close', function() {
                log('Client close');
                ext.end();
                ext.destroy();
            });
        });
    });

    ext.on('error', function(err) {
        log('Server error: ' + err);
    });
    
    ext.on('close', function() {
        log('Server close');
    });
}
