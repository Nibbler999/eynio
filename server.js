"use strict";

function getVersion()
{
    delete require.cache[require.resolve('./package.json')];
    return require('./package.json').version;
}

var program = require('commander');

program
  .version(getVersion())
  .option('-l, --loglevel [level]', 'Log level (fatal, error, warn, info, debug, trace) [info]', 'info')
  .option('--nocolor', 'Disable colors in terminal output', false)
  .parse(process.argv);

var log = require('./lib/logger.js')(program, process.stdout);

require('./lib/main.js')(log);

