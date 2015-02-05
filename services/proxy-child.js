
process.on('message', function(proxy) {

    var ext = require('net').connect(proxy.port, proxy.host, function() {
    
        ext.write(proxy.request);
    
        require('tls').connect({host: 'nhome.ba', port: 8082}, function() {

            this.setNoDelay();

            this.write(proxy.id);

            ext.pipe(this).pipe(ext);
    
            this.on('error', function(err) {
                process.send(err.message);
                ext.end();
                ext.destroy();
                process.exit();
            });
    
            this.on('close', function() {
                ext.end();
                ext.destroy();
                process.exit();
            });
        });
    });
    
    ext.on('error', function(err) {
        process.send(err.message);
    });

    ext.on('close', function() {
        process.exit();
    });
});
