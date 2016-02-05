"use strict";

var conn;

var logger, actionlogger;

var fs = require('fs');
var mkdirp = require('mkdirp');

module.exports = function (c, l) {

    conn = c;
    logger = l.child({component: 'Logger'});

    conn.on('log', function (command) {
        formattedLog.apply(command, command.args);
    });

    conn.on('getLog', function (command) {
        getLog.apply(command, command.args);
    });

    conn.on('appendActionLog', function (entry) {
        actionlogger.info({entry: entry});
    });

    conn.on('getActionLog', function (command) {
        getActionLog.apply(command, command.args);
    });

    createActionLogger();
};

function getActionLogFile()
{
    var path = require('path');

    var home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

    var dirname = 'nhome';

    if (require('os').type() === 'Linux') {
        dirname = '.' + dirname;
    }

    var fullpath = path.join(home, dirname);

    mkdirp.sync(fullpath, parseInt('0700', 8));

    var filepath = path.join(fullpath, 'action.log');

    return filepath;
}

function createActionLogger()
{
    var bunyan = require('bunyan');

    // Force local time instead of UTC
    bunyan.RotatingFileStream.prototype._nextRotTime = function() {
        var d = new Date();
        return +new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
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
    var PrettyStream = require('bunyan-prettystream');

    var prettyLog = new PrettyStream({mode: 'short', useColor: false});

    var ringbuffer = logger.streams[1].stream;

    var entries = ringbuffer.records.map(prettyLog.formatRecord).join('');

    conn.broadcast('log', entries);

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

        logger.error(e);

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

