"use strict";

var path = require('path');
var async = require('async');
var mkdirp = require('mkdirp');

var ConfigFile = require('../lib/configfile.js');

var Configuration = {};

var logger;

Configuration.load = function (l, options, cb) {

    logger = l.child({component: 'Config'});

    Configuration.options = options;

    async.parallel([
        function (done) {

            var filename = Configuration.getConfFile();

            var conf = new ConfigFile(filename, logger, function (success) {

                if (success) {

                    Configuration.get = conf.get.bind(conf);
                    Configuration.getAll = conf.getAll.bind(conf);
                    Configuration.set = conf.set.bind(conf);
                    Configuration.setMulti = conf.setMulti.bind(conf);
                    Configuration.setAll = conf.setAll.bind(conf);
                    Configuration.delete = conf.delete.bind(conf);

                    done();

                } else {
                    done(new Error('Failed to load config'));
                }
            });
        },
        function (done) {

            var filename = path.join(Configuration.getVideoDirectory(), 'index.json');

            var cfglogger = l.child({component: 'Recordings'});

            var configfile = new ConfigFile(filename, cfglogger, function (success) {

                if (success) {

                    Configuration.recordings = configfile;

                    done();

                } else {
                    done(new Error('Failed to load video configfile'));
                }
            });
        },
        function (done) {

            var filename = path.join(Configuration.getSnapshotDirectory(), 'index.json');

            var cfglogger = l.child({component: 'Snapshots'});

            var configfile = new ConfigFile(filename, cfglogger, function (success) {

                if (success) {

                    Configuration.snapshots = configfile;

                    done();

                } else {
                    done(new Error('Failed to load snapshot configfile'));
                }
            });
        },
        function (done) {
            mkdirp(Configuration.getConfigDirectory(), parseInt('0700', 8), done);
        }
    ], function (err) {

        if (err) {
            logger.error(err);
        } else {

            var serverid = Configuration.get('serverid');

            if (!serverid) {
                var uuid = getUUID();
                registerServer(uuid, cb);
            } else {
                cb();
            }
        }
    });
};

Configuration.getHomeDirectory = function() {
    return process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
}

Configuration.getVideoDirectory = function() {

    var home = Configuration.getHomeDirectory();

    var dirname = 'nhome-videos';

    if (require('os').type() === 'Linux') {
        dirname = '.' + dirname;
    }

    var fullpath = path.join(home, dirname);

    return fullpath;
}

Configuration.getSnapshotDirectory = function() {

    var home = Configuration.getHomeDirectory();

    var dirname = 'nhome-snapshots';

    if (require('os').type() === 'Linux') {
        dirname = '.' + dirname;
    }

    var fullpath = path.join(home, dirname);

    return fullpath;
}

Configuration.getConfigDirectory = function() {

    var home = Configuration.getHomeDirectory();

    var dirname = 'nhome';

    if (require('os').type() === 'Linux') {
        dirname = '.' + dirname;
    }

    return path.join(home, dirname);
}

Configuration.getConfFile = function () {

    var home = Configuration.getHomeDirectory();

    var filename = 'nhome-conf.json';

    if (require('os').type() === 'Linux') {
        filename = '.' + filename;
    }

    var filepath = path.join(home, filename);

    return filepath;
}

function getUUID()
{
    logger.info('Generating new uuid');
    var uuid = require('node-uuid').v4();
    logger.debug(uuid);
    return uuid;
}

function registerServer(uuid, cb)
{
    var get = require('simple-get');
    var querystring = require('querystring');

    var url = 'https://nhome.ba/api/register_server';

    var postdata = querystring.stringify({
        uuid: uuid,
        company: Configuration.options.companykey
    });

    var params = {
        url: url,
        body: postdata,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postdata)
        }
    };

    get.concat(params, function (err, res, body) {

        if (err) {
            logger.error('Unable to connect to server. Will retry in 20s');
            setTimeout(registerServer, 20 * 1000, uuid, cb);
            return;
        }

        if (res.statusCode !== 200) {
            logger.error('Server registration error', res.statusCode, '. Will retry in 20s');
            logger.debug(body);
            setTimeout(registerServer, 20 * 1000, uuid, cb);
            return;
        }

        var response = JSON.parse(body);

        Configuration.setMulti({
            'serverid': parseInt(response.serverid),
            'uuid': uuid
        });

        cb();
    });
}

module.exports = Configuration;

