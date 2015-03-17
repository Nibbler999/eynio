"use strict";

var Configuration = {}, conf = {};

var logger;

Configuration.load = function (l, cb) {

    logger = l.child({component: 'Config'});

    load(function(success) {
        if (success) {
            logger.debug('Configuration data', conf);
            cb();
        } else {
            logger.error('Failed to load config');
        }
    });
};

Configuration.getAll = function () {
    return conf;
};

Configuration.get = function (key, def) {
    return conf.hasOwnProperty(key) ? conf[key] : def;
};

Configuration.set = function (key, value) {
    logger.debug('Set', key, 'to', value);
    conf[key] = value;
    save();
    return value;
};

Configuration.setAll = function (newconfig) {
    conf = newconfig;
    save();
};

function getConfFile()
{
    var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

    var filename = 'nhome-conf.json';

    if (require('os').type() === 'Linux') {
        filename = '.' + filename;
    }

    var filepath = require('path').join(home, filename);

    return filepath;
}

function load(cb)
{
    var filepath = getConfFile();

    logger.debug('Configuration file', filepath);

    require('fs').readFile(filepath, { encoding: 'utf8'}, function (err, data) {
        if (err) {
            if (err.code === 'ENOENT') {
                init(cb);
            } else {
                logger.error(err);
                cb(false);
            }
        } else {
            try {
                conf = JSON.parse(data);
                cb(true);
            } catch (e) {
                logger.error(e);
                cb(false);
            }
        }
    });
}

function save(cb)
{
    var filepath = getConfFile();

    var content = JSON.stringify(conf);

    require('fs').writeFile(filepath, content, { encoding: 'utf8'}, function (err) {
        if (err) {
            logger.error(err);
            if (cb) cb(false);
        } else {
            if (cb) cb(true);
        }
    });
}

function init(cb)
{
    save(function (success) {
        if (success) {
            logger.info('New config file created');
            cb(true);
        } else {
            cb(false);
        }
    });
}

module.exports = Configuration;

