var io = require('socket.io-client');

var serverUrl = 'http://nhome.neosoft.ba:8080';
var conn = io.connect(serverUrl);

conn.on('connect', function () {

    console.log('Connected to socket.io');

    conn.emit('serverhello', { uuid: 1234 });
});

conn.on('disconnect', function () {
    console.log('disconnected');
});

require('./hue.js')(conn);
