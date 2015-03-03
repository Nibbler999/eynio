"use strict";

var conn;
var jobs = [];
var schedule = [];

var logger;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Schedule'});

    var cfg = require('../configuration.js');
    schedule = cfg.get('schedule', []);

    if (schedule.length > 0) {
        reloadSchedule();
    }

    conn.on('saveSchedule', function (newSchedule, cb) {
        schedule = newSchedule;
        saveSchedule(cb);
        logger.info('Set new schedule');
    });

    conn.on('addScheduleItem', function (item, cb) {
        schedule.push(item);
        saveSchedule(cb);
        logger.info('Added new schedule item');
    });

    conn.on('deleteScheduleItem', function (index, cb) {
        if (index < schedule.length) {
            schedule.splice(index, 1);
            saveSchedule(cb);
            logger.info('Deleted schedule item');
        }
    });

    conn.on('getSchedule', function (cb) {
        conn.broadcast('schedule', schedule);
        if (cb) cb(schedule);
    });
};

function saveSchedule(cb)
{
    var cfg = require('../configuration.js');
    cfg.set('schedule', schedule);

    reloadSchedule(cb);
}

function reloadSchedule(cb)
{
    jobs.forEach(function (j) {
        j.cancel();
    });

    logger.info('Cleared schedule');

    if (!schedule) {
        if (cb) cb([]);
        return;
    }

    var scheduler = require('node-schedule');

    schedule.forEach(function (s) {

        var j = scheduler.scheduleJob(s.dateTime, function() {
            var params = [s.emit];
            params = params.concat(s.params);
            conn.emit.apply(conn, params);
        });

        jobs.push(j);

        logger.info('Scheduled job');
    });

    if (cb) cb(schedule);
}
