"use strict";

module.exports = function () {

    var program = require('commander');

    program
      .version(require('../package.json').version)
      .option('-l, --loglevel [level]', 'Log level (fatal, error, warn, info, debug, trace) [info]', 'info')
      .option('--nocolor', 'Disable colors in terminal output', false)
      .option('--pidfile [path]', 'Save a pid file at the given path', '')
      .option('--platform [platform]', 'Set platform', '')
      .option('--autostart', 'Run in tray (nwjs only)', '')
      .parse(process.argv);

    var log = require('./logger.js')(program, process.stdout);

    if (program.pidfile) {

        var fs = require('fs');

        fs.writeFile(program.pidfile, process.pid, function (err) {
            if (err) {
                log.error('Failed to write pidfile: ' + err);
            }
        });
    }

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
        require('./services/logs.js')(conn, log);
        require('./services/streaming.js')(conn, log);
        require('./services/recording.js')(conn, log);
        require('./services/motion.js')(conn, log);
        require('./services/cameras.js')(conn, log);
        require('./services/scenes.js')(conn, log);
        require('./services/weather.js')(conn, log);
        require('./services/blacklist.js')(conn, log);
        require('./services/remotes.js')(conn, log);
        require('./services/device-properties.js')(conn, log);
        require('./services/alarm.js')(conn, log);
        require('./services/triggers.js')(conn, log);
        require('./services/foscam.js')(conn, log);

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
    });
};

