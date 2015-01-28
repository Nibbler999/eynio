"use strict";

module.exports = function(loglevel) {

    var bunyan = require('bunyan');
    var PrettyStream = require('bunyan-prettystream');
    
    var prettyStdOut = new PrettyStream({mode: 'short'});
    prettyStdOut.pipe(process.stdout);
    
    var ringbuffer = new bunyan.RingBuffer({ limit: 100 });
    
    var log = bunyan.createLogger({
        name: 'NHome',
        streams: [{
            level: loglevel,
            stream: prettyStdOut
        },{
            level: loglevel,
            type: 'raw',
            stream: ringbuffer
        }]
    });
    
    console.log = function() {
        log.info.apply(log, arguments);   
    };

    console.info = function() {
        log.info.apply(log, arguments);   
    };

    console.error = function() {
        log.error.apply(log, arguments);   
    };

    console.warn = function() {
        log.warn.apply(log, arguments);   
    };

    console.dir = function() {
        log.info.apply(log, arguments);   
    };

    console.trace = function() {
        log.trace.apply(log, arguments);   
    };

    return log;
};