"use strict";

function getVersion()
{
    delete require.cache[require.resolve('./package.json')];
    return require('./package.json').version;
}

var options = require('commander');

options
  .version(getVersion())
  .option('-l, --loglevel [level]', 'log level (fatal, error, warn, info, debug, trace) [info]', 'info')
  .option('-s, --server [hostname]', 'connect to alternative server')
  .option('--nocolor', 'disable colors in terminal output', false)
  .parse(process.argv);

var log = require('./logger.js')(options);

require('./main.js')(log, options);

