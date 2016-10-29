"use strict";

var spawn = require('child_process').spawn;

var opts = {
    stdio: [
        'pipe', // stdin
        'pipe', // stdout
        'ignore' // stderr
    ]
};

var Decoder = function () {

    var width = 256;
    var height = 256;

    this.callbacks = [];

    this.ffmpeg = 'ffmpeg';

    if (process.env.PROCESSOR_ARCHITEW6432) {
        this.ffmpeg  = 'ffmpeg64';
    }

    this.child = spawn(this.ffmpeg, ['-f', 'mjpeg', '-i', '-', '-vf', 'scale=' + width + 'x' + height, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], opts);

    var size = width * height;

    var self = this;

    this.child.stdout.on('readable', function () {

        var data = this.read(size);

        if (data) {
            var cb = self.callbacks.shift();
            if (cb) {
                cb(null, data);
            }
        }
    });
}

Decoder.prototype.decode = function (image, callback) {
    this.child.stdin.write(image);
    this.callbacks.push(callback);
};

module.exports = Decoder;

