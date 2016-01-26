"use strict";

var conn;

var logger, actionlogger;

var cfg = require('../configuration.js');

module.exports = function (c, l) {

    conn = c;
    logger = l.child({component: 'Info'});

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
    var home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

    var filename = 'nhome-action.log';

    if (require('os').type() === 'Linux') {
        filename = '.' + filename;
    }

    var filepath = require('path').join(home, filename);

    return filepath;
}

function createActionLogger()
{
    var fs = require('fs');
    var bunyan = require('bunyan');

    var actionLogFile = getActionLogFile();

    var maxEntries = 100;

    var ringbuffer = new bunyan.RingBuffer({ limit: maxEntries });

    try {

        var actionLog = fs.readFileSync(actionLogFile, { encoding: 'utf8' }).trim().split('\n');

        if (actionLog.length > maxEntries) {
            actionLog = actionLog.slice(-maxEntries);
        }

        actionLog.forEach(function (line) {
            if (!line) {
                return;
            }
            try {
                var record = JSON.parse(line);
                ringbuffer.write(record);
            } catch (e) {
                console.log('Failed to parse actionlog line', line);
            }
        });

        if (actionLog[0]) {
            fs.writeFileSync(actionLogFile, actionLog.join('\n') + '\n');
        }

    } catch (e) { /* log file does not exist */ }

    actionlogger = bunyan.createLogger({
        name: 'NHome',
        streams: [{
            type: 'raw',
            stream: ringbuffer
        }, {
            path: actionLogFile
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

function getActionLog(cb)
{
    var ringbuffer = actionlogger.streams[0].stream;

    var entries = ringbuffer.records.map(formatActionLog);

    if (typeof cb === 'function') {
        cb(entries);
    }
}
