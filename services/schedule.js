
var scheduler = require('node-schedule');
var conn;
var jobs = [];
var schedule = [];

function log(msg)
{
    console.log('[Schedule]', msg);
}

module.exports = function(c) {

    conn = c;

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

    conn.on('getSchedule', function () {
        conn.emit('schedule', schedule);
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
