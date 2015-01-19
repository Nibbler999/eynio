
var scheduler = require('node-schedule');
var conn;
var jobs = [];
var schedule = [];

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Schedule'});

    conn.once('accepted', function (cfg) {

        if (cfg.schedule) {
            schedule = JSON.parse(cfg.schedule);
            reloadSchedule();
        }
    });

    conn.on('saveSchedule', function (newSchedule) {
        schedule = newSchedule;
        saveSchedule();
        log('Set new schedule');
    });

    conn.on('addScheduleItem', function (item) {
        schedule.push(item);
        saveSchedule();
        log('Added new schedule item');
    });

    conn.on('deleteScheduleItem', function (index) {
        if (index < schedule.length) {
            schedule.splice(index, 1);
            saveSchedule();
            log('Deleted schedule item');
        }
    });

    conn.on('getSchedule', function (cb) {
        conn.emit('schedule', schedule);
        if (cb) cb(schedule);
    });
}

function saveSchedule()
{
    conn.emit('setConfig', { schedule: JSON.stringify(schedule) });
    reloadSchedule();
}

function reloadSchedule()
{
    jobs.forEach(function (j) {
        j.cancel();
    });

    log('Cleared schedule');

    if (!schedule) {
        return;
    }

    schedule.forEach(function (s) {

        var j = scheduler.scheduleJob(s.dateTime, function() {
            var params = [s.emit];
            params = params.concat(s.params);
            conn.emitLocal.apply(conn, params);
        });

        jobs.push(j);

        log('Scheduled job');
    });
}
