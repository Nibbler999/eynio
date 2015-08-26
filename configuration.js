"use strict";

var Configuration = {}, conf = {};

var logger;

Configuration.load = function (l, cb) {

    logger = l.child({component: 'Config'});

    load(function(success) {
        if (success) {

            var uuid = getUUID();

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
    var home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

    var filename = 'nhome-conf.json';

    if (require('os').type() === 'Linux') {
        filename = '.' + filename;
    }

    var filepath = require('path').join(home, filename);

    return filepath;
}

function getUUID()
{
    var home = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

    var uuidFile = require('path').join(home, 'nhome-uuid');

    var fs = require('fs');

    if (!fs.existsSync(uuidFile)) {
        logger.info('Generating new uuid');
        var uuid = require('node-uuid').v4();
        logger.debug(uuid);
        fs.writeFileSync(uuidFile, uuid);
    }

    return fs.readFileSync(uuidFile, { encoding: 'utf8'});
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
    try {

        var filepath = getConfFile();
        var content = JSON.stringify(conf);

        require('fs').writeFileSync(filepath, content, { encoding: 'utf8'});

        if (cb) {
            process.nextTick(function() {
                cb(true);
            });
        }

    } catch (err) {

        logger.error(err);

        if (cb) {
            process.nextTick(function() {
                cb(false);
            });
        }
    }
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

function registerServer(uuid, cb)
{
    var url = 'https://nhome.ba/user/api_register_server';

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

