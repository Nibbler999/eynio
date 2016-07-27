"use strict";

module.exports = function () {

    var program = require('commander');
    var glob = require('glob');
    var path = require('path');

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

        log.debug('Loading modules');

        require('./streaming/core.js')(log);

        glob("./{services,devices}/*.js", { cwd: __dirname }, function (err, files) {

            if (err) {
                log.error(err);
            }

            var blacklist = cfg.get('blacklist_modules', []);

            files.filter(function (file) {
                return blacklist.indexOf(path.basename(file, '.js')) === -1;
            }).forEach(function (file) {
                require(file)(conn, log);
            });

            log.info('Connecting...');

            conn.connect();
        });
    });
};

