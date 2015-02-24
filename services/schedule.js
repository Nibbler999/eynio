"use strict";

var conn;
var jobs = [];
var schedule = [];

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Schedule'});

    conn.once('configured', function (cfg) {

        if (cfg.schedule) {
            schedule = cfg.schedule;
            reloadSchedule();
        }
    });

    conn.on('saveSchedule', function (newSchedule) {
        schedule = newSchedule;
        saveSchedule();
        logger.info('Set new schedule');
    });

    conn.on('addScheduleItem', function (item) {
        schedule.push(item);
        saveSchedule();
        logger.info('Added new schedule item');
    });

    conn.on('deleteScheduleItem', function (index) {
        if (index < schedule.length) {
            schedule.splice(index, 1);
            saveSchedule();
            logger.info('Deleted schedule item');
        }
    });

    conn.on('getSchedule', function (cb) {
        conn.emit('schedule', schedule);
        if (cb) cb(schedule);
    });
};

function saveSchedule()
{
    var cfg = require('../configuration.js');
    cfg.set('schedule', schedule);

    reloadSchedule();
}

function reloadSchedule()
{
    jobs.forEach(function (j) {
        j.cancel();
    });

    logger.info('Cleared schedule');

    if (!schedule) {
        return;
    }

    var scheduler = require('node-schedule');

    schedule.forEach(function (s) {

        var j = scheduler.scheduleJob(s.dateTime, function() {
            var params = [s.emit];
            params = params.concat(s.params);
            conn.emitLocal.apply(conn, params);
        });

        jobs.push(j);

        logger.info('Scheduled job');
    });
}
