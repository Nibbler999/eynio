"use strict";

var conn;
var jobs = {};
var schedule = {};

var cfg = require('../configuration.js');
var hash_to_array = require('../common.js').hash_to_array;

var logger, sun;

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'Schedule'});

    schedule = cfg.get('schedule', {});

    if (Object.keys(schedule).length > 0) {
        loadSchedule();
    }

    setupSunEvents();

    conn.on('addNewJob', function (command) {
        addNewJob.apply(command, command.args);
    });

    conn.on('updateJob', function (command) {
        updateJob.apply(command, command.args);
    });

    conn.on('updateJobItems', function (command) {
        updateJobItems.apply(command, command.args);
    });

    conn.on('removeJob', function (command) {
        removeJob.apply(command, command.args);
    });

    conn.on('getJobs', function (command) {
        getJobs.apply(command, command.args);
    });

    conn.on('findJobs', function (command) {
        findJobs.apply(command, command.args);
    });
};

function loadSchedule()
{
    if (Object.keys(schedule).length === 0) {
        return;
    }

    var job;

    for (var i in schedule) {

        job = schedule[i];

        if (!scheduleJob(job)) {
            logger.error('Invalid job', job.name);
        }
    }
}

function addNewJob(job, cb)
{
    job.id = require('uuid/v4')();

    if (scheduleJob(job)) {

        schedule[job.id] = job;

        save();

        logger.debug('Scheduled job');

        conn.broadcast('jobAdded', job);

        if (typeof cb === 'function') {
            cb(job.id);
        }

    } else {

        if (typeof cb === 'function') {
            cb(false);
        }

        logger.error('Invalid job', job.name);
    }
}

function updateJob(job, cb)
{
    var newjob = JSON.parse(JSON.stringify(schedule[job.id]));

    for (var prop in job) {
        newjob[prop] = job[prop];
    }

    var success = scheduleJob(newjob);

    if (!success) {
        if (typeof cb === 'function') {
            cb(false);
        }
        logger.error('Invalid job', newjob.name);
        return false;
    }

    schedule[job.id] = newjob;

    save();

    logger.debug('Updated schedule');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function updateJobItems(id, actions, cb)
{
    schedule[id].actions = actions;

    save();

    logger.debug('Updated schedule actions');

    if (typeof cb === 'function') {
        cb(true);
    }
}

function removeJob(id, cb)
{
    if (schedule.hasOwnProperty(id)) {

        delete schedule[id];

        if (jobs[id]) {
            jobs[id].cancel();
            delete jobs[id];
        }

        logger.debug('Deleted schedule item');

        conn.broadcast('jobRemoved', id);

        save();

        if (typeof cb === 'function') {
            cb(true);
        }

    } else {

        if (typeof cb === 'function') {
            cb(false);
        }
    }
}

function getJobs(cb)
{
    var s = hash_to_array(schedule);

    if (typeof cb === 'function') {
        cb(s);
    }
}

function findJobs(id, cb)
{
    var job, results = [];

    for (var i in schedule) {

        job = schedule[i];

        for (var j = 0; j < job.actions.length; j++) {

            if (job.actions[j].params[0] === id) {
                results.push(job);
                break;
            }
        }
    }

    if (typeof cb === 'function') {
        cb(results);
    }
}

function save()
{
    cfg.set('schedule', schedule);
}

function scheduleJob(job)
{
    if (!validateJob(job)) {
        return false;
    }

    if (job.dateTime.sunset || job.dateTime.sunrise) {
        return true;
    }

    var scheduler = require('node-schedule');

    var datetime = job.dateTime.timestamp ? new Date(job.dateTime.timestamp) : job.dateTime;

    var j = scheduler.scheduleJob(datetime, function () {
        runJob(job.id);
    });

    if (!j) {
        return false;
    }

    if (jobs[job.id]) {
        jobs[job.id].cancel();
    }

    jobs[job.id] = j;

    return true;
}

function validateJob(job)
{
    if (!job.hasOwnProperty('dateTime') || job.dateTime === null) {
        return false;
    }

    if (job.dateTime.timestamp) {
        return true;
    }

    if (job.dateTime.sunset || job.dateTime.sunrise) {
        return true;
    }

    var intervals = ['year', 'month', 'day', 'hour', 'minute', 'second'];

    intervals.forEach(function (interval) {

        if (job.dateTime.hasOwnProperty(interval)) {
            job.dateTime[interval] = parseInt(job.dateTime[interval]);
        }
    });

    if (job.dateTime.dayOfWeek) {

        if (Array.isArray(job.dateTime.dayOfWeek)) {

            if (job.dateTime.dayOfWeek.length === 0) {
                return false;
            }

            for (var d = 0; d < job.dateTime.dayOfWeek.length; d++) {
                if (typeof job.dateTime.dayOfWeek[d] !== 'number') {
                    return false;
                }
            }

        } else {
            return false;
        }
    }

    return true;
}

function runJob(id)
{
    var job = schedule[id];

    logger.debug('Running job', job.name);

    // Delete job if one-time
    if (job.dateTime.year || job.dateTime.timestamp) {
        removeJob(id);
    }

    job.actions.forEach(function (jobAction) {

        var command = {
            name: jobAction.emit_name,
            args: jobAction.params
        };

        command.log = function (deviceid, devicename, action) {

            var entry = {
                user_name: job.name,
                id: deviceid,
                device: devicename,
                action: action
            };

            conn.emit('appendActionLog', entry);
        };

        conn.emit(command.name, command);
    });
}

function setupSunEvents()
{
    var latitude = cfg.get('latitude', null);
    var longitude = cfg.get('longitude', null);

    if (latitude !== null && longitude !== null) {

        sun = require('iotdb-timers');

        if (sun.setLogger) {
            sun.setLogger(logger);
        }

        sun.setLocation(latitude, longitude);

        sun.sunrise(function (event) {
            logger.debug('Sunrise', event);
            sunEvent('sunrise');
        });

        sun.sunset(function (event) {
            logger.debug('Sunset', event);
            sunEvent('sunset');
        });
    }
}

function sunEvent(which)
{
    for (var id in schedule) {

        if (schedule[id][which]) {
            runJob(id);
        }
    }
}

