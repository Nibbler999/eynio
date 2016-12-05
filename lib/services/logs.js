"use strict";

var conn;

var logger, actionlogger;

var fs = require('fs');
var path = require('path');

var cfg = require('../configuration.js');

var Logs = function (c, l) {

    conn = c;
    logger = l.child({component: 'Logger'});

    conn.on('log', function (command) {
        formattedLog.apply(command, command.args);
    });

    conn.on('getLog', function (command) {
        getLog.apply(command, command.args);
    });

    conn.on('appendActionLog', function (entry) {
        appendActionLog(entry);
    });

    conn.on('getActionLog', function (command) {
        getActionLog.apply(command, command.args);
    });

    createActionLogger();
};

function getActionLogFile()
{
    var configDir = cfg.getConfigDirectory();

    return path.join(configDir, 'action.log');
}

function createActionLogger()
{
    var bunyan = require('bunyan');

    // Force local time instead of UTC
    bunyan.RotatingFileStream.prototype._calcRotTime = function(periodOffset) {
        var d = new Date();
        return +new Date(d.getFullYear(), d.getMonth(), d.getDate() + periodOffset);
    };

    var actionLogFile = getActionLogFile();

    actionlogger = bunyan.createLogger({
        name: 'NHome',
        streams: [{
            type: 'rotating-file',
            path: actionLogFile,
            period: '1d',
            count: 30
        }]
    });
}

function formattedLog(cb)
{
    var PrettyStream = require('../prettystream');

    var prettyLog = new PrettyStream({mode: 'short', useColor: false});

    var ringbuffer = logger.streams[1].stream;

    var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');

    if (typeof cb === 'function') {
        cb(entries);
    }
}

function getLog(cb)
{
    var ringbuffer = logger.streams[1].stream;

    var entries = ringbuffer.records.map(formatDateAsTimestamp);

    if (typeof cb === 'function') {
        cb(entries);
    }
}

function formatDateAsTimestamp(entry)
{
    var newEntry = JSON.parse(JSON.stringify(entry));

    newEntry.time = Math.round(new Date(newEntry.time).getTime() / 1000);

    return newEntry;
}

function formatActionLog(line)
{
    var newEntry = {
        time: new Date(line.time).getTime(),
        user: line.entry.user_name,
        device: line.entry.device,
        action: line.entry.action
    };

    return newEntry;
}

function getActionLog(index, cb)
{
    // BC for version without index
    if (typeof index === 'function') {
        cb = index;
        index = 0;
    }

    // if index is 0, today
    // else index is for rotation - index days ago

    var actionLogFile = getActionLogFile();

    if (index) {
        actionLogFile += '.' + (index - 1);
    }

    try {

        var actionLog = fs.readFileSync(actionLogFile, { encoding: 'utf8' }).trim().split('\n');

    } catch (e) {

        logger.debug(e);

        if (typeof cb === 'function') {
            cb([]);
        }

        return;
    }

    var entries = [];

    actionLog.forEach(function (line) {
        if (!line) {
            return;
        }
        try {
            entries.push(JSON.parse(line));
        } catch (e) {
            logger.error('Failed to parse actionlog line', line, e);
        }
    });

    entries = entries.map(formatActionLog);

    if (typeof cb === 'function') {
        cb(entries);
    }
}

function appendActionLog(entry)
{
    actionlogger.info({entry: entry});

    var event = {
        time: +new Date(),
        user: entry.user_name,
        device: entry.device,
        action: entry.action
    };

    conn.broadcast('actionLogUpdate', event);
}

Logs.formattedLog = formattedLog;

module.exports = Logs;

