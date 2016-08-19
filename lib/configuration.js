"use strict";

var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var queue = require('async/queue');
var waterfall = require('async/waterfall');

var Configuration = {}, conf = {};

var logger;

Configuration.load = function (l, cb) {

    logger = l.child({component: 'Config'});

    load(function(success) {
        if (success) {

            var uuid = Configuration.get('uuid', '');

            if (uuid === '') {
                uuid = getUUID();
            }

            logger.debug('Configuration data', conf);

            if (!conf.serverid) {

                logger.debug('Requesting server id');

                registerServer(uuid, cb);

            } else {
                cb(conf.serverid, uuid);
            }

        } else {
            logger.error('Failed to load config');
        }
    });

    var configDir = Configuration.getConfigDirectory();
    mkdirp.sync(configDir, parseInt('0700', 8));

    var videoDir = Configuration.getVideoDirectory();
    mkdirp.sync(videoDir, parseInt('0700', 8));
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

Configuration.setMulti = function (multi) {

    for (var key in multi) {
        logger.debug('Set', key, 'to', multi[key]);
        conf[key] = multi[key];
    }

    save();
    return multi;
};

Configuration.setAll = function (newconfig) {
    conf = newconfig;
    save();
};

Configuration.getHomeDirectory = function () {
    return process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
};

Configuration.getConfigDirectory = function () {

    var home = Configuration.getHomeDirectory();

    var dirname = 'nhome';

    if (require('os').type() === 'Linux') {
        dirname = '.' + dirname;
    }

    return path.join(home, dirname);
};

Configuration.getVideoDirectory = function () {

    var home = Configuration.getHomeDirectory();

    var dirname = 'nhome-videos';

    if (require('os').type() === 'Linux') {
        dirname = '.' + dirname;
    }

    var fullpath = path.join(home, dirname);

    return fullpath;
};

function getConfFile()
{
    var home = Configuration.getHomeDirectory();

    var filename = 'nhome-conf.json';

    if (require('os').type() === 'Linux') {
        filename = '.' + filename;
    }

    var filepath = path.join(home, filename);

    return filepath;
}

function copyFile(from, to, cb)
{
    var fromFile = fs.createReadStream(from),
        toFile = fs.createWriteStream(to),
        err,
        onError = function (e) {
            err = e;
        };

    fromFile.on('error', onError);
    toFile.on('error', onError);

    if (cb) {
        fromFile.once('end', function() {
            cb(err);
        });
    }

    fromFile.pipe(toFile);
}

function getUUID()
{
    var home = Configuration.getHomeDirectory();

    var uuidFile = path.join(home, 'nhome-uuid');

    if (!fs.existsSync(uuidFile)) {
        logger.info('Generating new uuid');
        var uuid = require('node-uuid').v4();
        logger.debug(uuid);
        return uuid;
    }

    return fs.readFileSync(uuidFile, { encoding: 'utf8'});
}

function load(cb, isBackup)
{
    var filepath = getConfFile();

    logger.debug('Configuration file', filepath);

    fs.readFile(filepath, { encoding: 'utf8'}, function (err, data) {
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
            } catch (e) {
                logger.error(e);

                if (isBackup) {
                    cb(false);
                    return;
                }

                copyFile(filepath + '.bkp', filepath, function (err) {

                    if (err) {
                        logger.error('Error restoring backup config file', err);
                        cb(false);
                        return;
                    }

                    logger.warn('Loading backup config file');

                    load(cb, true);
                });

                return;
            }

            cb(true);

            if (!isBackup) {
                copyFile(filepath, filepath + '.bkp', function (err) {
                    if (err) {
                        logger.error('Error creating backup config file', err);
                    }
                });
            }
        }
    });
}

var saveQueue = queue(function (content, cb) {

    var fd;
    var filepath = getConfFile();

    waterfall([
        function (callback) {
            fs.open(filepath + '.new', 'w', callback);
        },
        function (thisfd, callback) {
            fd = thisfd;
            fs.write(fd, content, 0, 'utf8', callback);
        },
        function (written, string, callback) {
            fs.fsync(fd, callback);
        },
        function (callback) {
            fs.close(fd, callback);
        },
        function (callback) {
            fs.rename(filepath + '.new', filepath, callback);
        }
    ], function (err) {
        if (err) {
            logger.error('Error saving config file', err);
        }
        cb(err);
    });
});

function save(cb)
{
    var content = JSON.stringify(conf, null, 2);

    saveQueue.push(content, function (err) {
        if (err) {

            logger.error(err);

            if (typeof cb === 'function') {
                cb(false);
            }

        } else {

            if (typeof cb === 'function') {
                cb(true);
            }
        }
    });
}

function init(cb)
{
    save(function (success) {
        if (success) {

            logger.info('New config file created');

            if (typeof cb === 'function') {
                cb(true);
            }

        } else {

            if (typeof cb === 'function') {
                cb(false);
            }
        }
    });
}

function registerServer(uuid, cb)
{
    var url = 'https://nhome.ba/api/register_server';

    require('request').post({url: url, form: { uuid: uuid }}, function (err, httpResponse, body) {

        if (err) {
            logger.error('Unable to connect to server. Will retry in 20s');
            setTimeout(registerServer, 20 * 1000, uuid, cb);
            return;
        }

        if (httpResponse.statusCode !== 200) {
            logger.error('Server registration error', httpResponse.statusCode, '. Will retry in 20s');
            logger.debug(body);
            setTimeout(registerServer, 20 * 1000, uuid, cb);
            return;
        }

        var response = JSON.parse(body);

        Configuration.set('serverid', parseInt(response.serverid));
        Configuration.set('uuid', uuid);

        cb(response.serverid, uuid);
    });
}

module.exports = Configuration;

