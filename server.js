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
  .parse(process.argv);

var log = require('./logger.js')(program.loglevel);

process.on('uncaughtException', function (err) {
    log.error('uncaughtException:' + err);
    log.error(err.stack);
});

log.debug('Loading configuration');

require('./configuration.js').load(log, configured);

function configured()
{
    var conn  = require('./connection.js')(log);

    log.debug('Loading modules');

    require('./services/namer.js').listen(conn, log);
    require('./services/cats.js').listen(conn, log);
    require('./services/schedule.js')(conn, log);
    require('./services/proxy.js')(conn, log);
    require('./services/info.js')(conn, log);
    require('./services/streaming.js')(conn, log);
    require('./services/cameras.js')(conn, log);
    require('./services/scenes.js')(conn, log);
    require('./services/weather.js')(conn, log);

    require('./devices/hue.js')(conn, log);
    require('./devices/wemo.js')(conn, log);
    require('./devices/insteon.js')(conn, log);
    require('./devices/itach.js')(conn, log);
    require('./devices/fibaro.js')(conn, log);
    require('./devices/razberry.js')(conn, log);
    require('./devices/lifx.js')(conn, log);
    require('./devices/netatmo.js')(conn, log);
    require('./devices/nhome.js')(conn, log);
    require('./devices/nest.js')(conn, log);

    log.info('Connecting...');

    conn.connect();
}

