
var log = require('./logger.js')();
var conn = require('./connection.js')(log);

require('./services/namer.js').listen(conn, log);
require('./services/schedule.js')(conn, log);
require('./services/proxy.js')(conn, log);
require('./services/info.js')(conn, log);
require('./services/mjpeg.js')(conn, log);

require('./devices/hue.js')(conn, log);
require('./devices/wemo.js')(conn, log);
require('./devices/lg.js')(conn, log);
require('./devices/insteon.js')(conn, log);
require('./devices/itach.js')(conn, log);
require('./devices/samsung-remote.js')(conn, log);
require('./devices/fibaro.js')(conn, log);
require('./devices/razberry.js')(conn, log);
require('./devices/lifx.js')(conn, log);
require('./devices/netatmo.js')(conn, log);

process.on('uncaughtException', function (err) {
	log.error('uncaughtException:' + err);
	log.error(err.stack);
});
