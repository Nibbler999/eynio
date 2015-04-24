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

    conn.on('saveSchedule', function (command) {
        saveSchedule.apply(command, command.args);
    });

    conn.on('addScheduleItem', function (command) {
        addScheduleItem.apply(command, command.args);
    });

    conn.on('deleteScheduleItem', function (command) {
        deleteScheduleItem.apply(command, command.args);
    });

    conn.on('getSchedule', function (command) {
        getSchedule.apply(command, command.args);
    });
};

function saveSchedule(newSchedule, cb)
{
    schedule = newSchedule;
    save(cb);
    logger.debug('Set new schedule');
}

function addScheduleItem(item, cb)
{
    schedule.push(item);
    save(cb);
    logger.debug('Added new schedule item');
}

function deleteScheduleItem(index, cb)
{
    if (index < schedule.length) {
        schedule.splice(index, 1);
        save(cb);
        logger.debug('Deleted schedule item');
    }
}

function getSchedule(cb)
{
    conn.broadcast('schedule', schedule);

    if (cb) cb(schedule);
}

function save(cb)
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

    logger.debug('Cleared schedule');

    if (!schedule) {
        if (cb) cb([]);
        return;
    }

    var scheduler = require('node-schedule');

    schedule.forEach(function (s) {

        var j = scheduler.scheduleJob(s.dateTime, function() {

            var command = {
                name: s.emit,
                args: s.params
            };

            command.log = function (device, action) {

                var entry = {
                    user: s.name,
                    device: device,
                    action: action
                };

                conn.send('appendActionLog', entry);
            };

            conn.emit(command.name, command);
        });

        jobs.push(j);

        logger.debug('Scheduled job');
    });

    if (cb) cb(schedule);
}
