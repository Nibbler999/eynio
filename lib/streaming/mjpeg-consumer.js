"use strict";

var util = require('util');
var Transform = require('stream').Transform;
var Buffer = require('safe-buffer').Buffer;
var BufferList = require('bl');

// Start of Image
var soi = Buffer.from([0xff, 0xd8]);

// End of Image
var eoi = Buffer.from([0xff, 0xd9]);

function MjpegConsumer(options) {
    if (!(this instanceof MjpegConsumer)) {
        return new MjpegConsumer(options);
    }

    Transform.call(this, options);

    this.bl = new BufferList();

    this.once('finish', function() {
        this.emit('end');
    });
}

util.inherits(MjpegConsumer, Transform);

MjpegConsumer.prototype._indexOf = function(needle, offset) {

    if (!this.bl.length) {
        return -1;
    }

    var i = 0, j = 0, prev = 0;

    // start search from a particular point in the virtual buffer
    if (offset) {
        var p = this.bl._offset(offset);
        i = p[0];
        j = p[1];
        prev = offset;
    }

    while (i < this.bl._bufs.length) {

        var s = this.bl._bufs[i].indexOf(needle, j);

        if (s !== -1) {
            return prev + s - j;
        }

        // Test for marker being split over buffer boundary
        if (this.bl._bufs[i + 1]
            && this.bl._bufs[i][this.bl._bufs[i].length -1] === needle[0]
            && this.bl._bufs[i + 1][0] === needle[1]) {
            return prev + (this.bl._bufs[i].length - 1) - j;
        }

        prev += this.bl._bufs[i].length - j;
        i++;
        j = 0;
    }

    return -1;
};

MjpegConsumer.prototype._transform = function(chunk, encoding, done) {

    this.bl.append(chunk);

    var start = this._indexOf(soi, 0);

    var end;

    while (start !== -1) {
        end = this._indexOf(eoi, start);
        if (end === -1) {
            break;
        }
        end += eoi.length;

        this.push(this.bl.slice(start, end));

        if (end === this.bl.length) {
            break;
        }

        start = this._indexOf(soi, end);
    }

    if (end > 0) {
        this.bl.consume(end);
    }

    done();
};

module.exports = MjpegConsumer;
