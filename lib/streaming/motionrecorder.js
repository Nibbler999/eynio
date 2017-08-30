"use strict";

var fs = require('fs');
var path = require('path');

var cfg = require('../configuration.js');

var streamcore = require('../streaming/core.js');

var options = {
    width: -1,
    height: -1,
    encoder: 'h264',
    framerate: 10
};

var dir = cfg.getVideoDirectory();

var MotionRecorder = function (recordingid, camera) {

    this.recordingid = recordingid;
    this.camera = camera;

    this.filename = path.join(dir, this.recordingid + '.mp4');

    this.motionStartTime = 0;
    this.motionStartReal = 0;

    this.initialised = false;

    this.destination = fs.createWriteStream(this.filename, 'binary');
    this.encoder = streamcore.getEncoder(options);

    this.ready = true;

    var self = this;

    this.encoder.on('error', function () {
        self.ready = false;
    });

    this.encoder.pipe(this.destination);
};

MotionRecorder.prototype.write = function (frame) {

    var self = this;

    if (!this.initialised) {
        this.motionStartTime = frame.time;
        this.motionStartReal = Date.now();
        this.makeThumbnail(frame);
        this.initialised = true;
    }

    setTimeout(function () {
        if (self.ready) {
            self.encoder.write(frame.data);
        }
        if (frame.isLastFrame) {
            self.end();
        }
    }, (frame.time - this.motionStartTime) - (Date.now() - this.motionStartReal));
};

MotionRecorder.prototype.makeThumbnail = function (frame) {

    var thumbnail = path.join(dir, this.recordingid + '.jpeg');

    streamcore.makeThumbnail(frame.data, this.camera, function (image) {
        fs.writeFile(thumbnail, image);
    });
};

MotionRecorder.prototype.end = function () {

    var self = this;

    this.encoder.on('finish', function () {

        self.destination.end(function () {

            streamcore.finalize(self.filename, function () {

                fs.stat(self.filename, function (err, stat) {

                    if (err) {
                        return;
                    }

                    var recordings = cfg.recordings.get('recordings', {});

                    recordings[self.recordingid].endtime = Date.now();
                    recordings[self.recordingid].size = stat.size;

                    cfg.recordings.set('recordings', recordings);
                });
            });
        });
    });

    this.encoder.destroy();
};

module.exports = MotionRecorder;
