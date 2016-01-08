"use strict";

module.exports = function (log, cb) {

    log.debug('Loading configuration');

    var cfg = require('./configuration.js');

    cfg.load(log, function (serverid, uuid) {

        var conn = require('./connection.js')(log, serverid, uuid);

        require('es6-promise').polyfill();

        log.debug('Loading services');

        require('./services/namer.js').listen(conn, log);
        require('./services/cats.js').listen(conn, log);
        require('./services/schedule.js')(conn, log);
        require('./services/info.js')(conn, log);
        require('./services/streaming.js')(conn, log);
        require('./services/recording.js')(conn, log);
        require('./services/cameras.js')(conn, log);
        require('./services/scenes.js')(conn, log);
        require('./services/weather.js')(conn, log);
        require('./services/blacklist.js')(conn, log);
        require('./services/remotes.js')(conn, log);
        require('./services/device-properties.js')(conn, log);
        require('./services/alarm.js')(conn, log);

        log.debug('Loading modules');

        var modules = ['hue', 'wemo', 'insteon', 'itach', 'fibaro',
            'razberry', 'lifx', 'netatmo', 'nhome', 'nest', 'nhomebridge',
            'ecobee'
        ];

        var blacklist = cfg.get('blacklist_modules', []);

        modules.filter(function (module) {
            return blacklist.indexOf(module) === -1;
        }).forEach(function (module) {
            require('./devices/' + module + '.js')(conn, log);
        });

        log.info('Connecting...');

        conn.connect();

        if (typeof cb === 'function') {
            cb(conn);
        }

        process.on('uncaughtException', function (err) {
            log.error('uncaughtException:' + err);
            log.error(err.stack);
        });
    });
};

