"use strict";

var fs = require('fs');
var path = require('path');
var queue = require('async/queue');
var waterfall = require('async/waterfall');
var mkdirp = require('mkdirp');

var ConfigFile = function (filepath, logger, cb) {
    this.conf = {};
    this.logger = logger;
    this.filepath = filepath;
    this.saveQueue = saveQueue(filepath);
    this.load(cb);
}

ConfigFile.prototype.get = function (key, def) {
    return this.conf.hasOwnProperty(key) ? this.conf[key] : def;
}

ConfigFile.prototype.getAll = function () {
    return this.conf;
}

ConfigFile.prototype.set = function (key, value) {
    this.logger.debug('Set', key, 'to', value);
    this.conf[key] = value;
    this.save();
    return value;
}

ConfigFile.prototype.setMulti = function (multi) {

    for (var key in multi) {
        this.logger.debug('Set', key, 'to', multi[key]);
        this.conf[key] = multi[key];
    }

    this.save();

    return multi;
}

ConfigFile.prototype.setAll = function (newconfig) {
    this.conf = newconfig;
    this.save();
}

ConfigFile.prototype.delete = function (key) {
    delete this.conf[key];
    this.save();
}

ConfigFile.prototype.load = function (cb, isBackup) {

    this.logger.debug('Configuration file', this.filepath);

    var self = this;

    fs.readFile(this.filepath, { encoding: 'utf8'}, function (err, data) {
        if (err) {
            if (err.code === 'ENOENT') {
                self.init(cb);
            } else {
                self.logger.error(err);
                cb(false);
            }
        } else {
            try {
                self.conf = JSON.parse(data);
            } catch (e) {
                self.logger.error(e);

                if (isBackup) {
                    cb(false);
                    return;
                }

                copyFile(self.filepath + '.bkp', self.filepath, function (err) {

                    if (err) {
                        self.logger.error('Error restoring backup config file', err);
                        cb(false);
                        return;
                    }

                    self.logger.warn('Loading backup config file');

                    self.load(cb, true);
                });

                return;
            }

            cb(true);

            if (!isBackup) {
                copyFile(self.filepath, self.filepath + '.bkp', function (err) {
                    if (err) {
                        self.logger.error('Error creating backup config file', err);
                    }
                });
            }
        }
    });
}

ConfigFile.prototype.init = function (cb) {

    var self = this;

    mkdirp(path.dirname(this.filepath), parseInt('0700', 8), function () {

        self.save(function (success) {
            if (success) {
                self.logger.info('New config file created');
            }
            cb(success);
        });
    });
}

ConfigFile.prototype.save = function (cb) {

    var self = this;

    var content = JSON.stringify(this.conf, null, 2);

    this.saveQueue.push(content, function (err) {
        if (err) {

            self.logger.error(err);

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

function saveQueue(filepath)
{
    return queue(function (content, cb) {

        var fd;

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
            cb(err);
        });
    });
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

module.exports = ConfigFile;
