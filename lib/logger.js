"use strict";

module.exports = function (opts, dest) {

    var bunyan = require('bunyan');
    var PrettyStream = require('bunyan-prettystream');

    var prettyStdOut = new PrettyStream({mode: 'short', useColor: !opts.nocolor});
    prettyStdOut.pipe(dest);

    var ringbuffer = new bunyan.RingBuffer({ limit: 100 });

    var log = bunyan.createLogger({
        name: 'NHome',
        streams: [{
            level: opts.loglevel,
            stream: prettyStdOut
        }, {
            level: opts.loglevel,
            type: 'raw',
            stream: ringbuffer
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

