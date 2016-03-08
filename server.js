"use strict";

function getVersion()
{
    return require('./package.json').version;
}

var program = require('commander');

program
  .version(getVersion())
  .option('-l, --loglevel [level]', 'Log level (fatal, error, warn, info, debug, trace) [info]', 'info')
  .option('--nocolor', 'Disable colors in terminal output', false)
  .option('--pidfile [path]', 'Save a pid file at the given path', '')
  .parse(process.argv);

var log = require('./lib/logger.js')(program, process.stdout);

if (program.pidfile) {

    var fs = require('fs');

    fs.writeFile(program.pidfile, process.pid, function (err) {
        if (err) {
            log.error('Failed to write pidfile: ' + err);
        }
    });
}

require('./lib/main.js')(log);

