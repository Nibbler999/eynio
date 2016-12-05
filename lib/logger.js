"use strict";

module.exports = function (opts, dest) {

    var fs = require('fs');
    var bunyan = require('bunyan');
    var PrettyStream = require('./prettystream');

    var prettyStdOut = new PrettyStream({mode: 'short', useColor: !opts.nocolor});
    prettyStdOut.pipe(dest);

    var maxEntries = 100;

    var ringbuffer = new bunyan.RingBuffer({ limit: maxEntries });

    var lastLogFile = getLastLog();

    try {

        var lastlog = fs.readFileSync(lastLogFile, { encoding: 'utf8' }).trim().split('\n');

        if (lastlog.length > maxEntries) {
            lastlog = lastlog.slice(-maxEntries);
        }

        lastlog.forEach(function (line) {
            try {
                var record = JSON.parse(line);
                ringbuffer.write(record);
            } catch (e) {
                console.log('Failed to parse lastlog line', line);
            }
        });

        fs.writeFileSync(lastLogFile, lastlog.join('\n') + '\n');

    } catch (e) { /* log file does not exist */ }

    var log = bunyan.createLogger({
        name: 'Eynio',
        streams: [{
            level: opts.loglevel,
            stream: prettyStdOut
        }, {
            level: opts.loglevel,
            type: 'raw',
            stream: ringbuffer
        }, {
            level: opts.loglevel,
            path: lastLogFile
        }]
    });

    if (log.trace()) {

        process.env.DEBUG = '*';

        console.info = console.error = function() {
            log.trace.apply(log, arguments);
        };
    }

    return log;
};

function getLastLog()
{
    var home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

    var filename = 'nhome-last.log';

    if (require('os').type() === 'Linux') {
        filename = '.' + filename;
    }

    var filepath = require('path').join(home, filename);

    return filepath;
}

