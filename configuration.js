"use strict";

var Configuration = {}, conf = {}, conn;

var logger;

Configuration.listen = function (c, l) {

    conn = c;
    logger = l.child({component: 'Config'});

    // Temporary
    conn.once('accepted', function (cfg) {

        if (Object.keys(cfg).length === 0) {

            load(function(success) {
                if (success) {
                    conn.emitLocal('configured', conf);
                }
            });

            return;
        }

        for (var id in cfg) {
            try {
                conf[id] = JSON.parse(cfg[id]);
            } catch (e) {
                conf[id] = cfg[id];
            }
        }

        save(function (success) {
            if (success) {
                conn.emit('deleteConfig');
                conn.emitLocal('configured', conf);
            }
        });
    });
};

Configuration.getAll = function () {
    return conf;
};

Configuration.get = function (key, def) {
    return conf.hasOwnProperty(key) ? conf[key] : def;
};

Configuration.set = function (key, value) {
    conf[key] = value;
    save();
    return value;
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

