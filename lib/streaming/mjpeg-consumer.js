var util = require('util');
var Transform = require('stream').Transform;

// Start of Image
var soi = new Buffer(2);
soi.writeUInt16LE(0xd8ff, 0);

// End of Image
var eoi = new Buffer(2);
eoi.writeUInt16LE(0xd9ff, 0);

var BufferList = require('bl');

BufferList.prototype.indexOf = function (needle, offset) {

    if (!this.length) {
        return -1;
    }

    var i = 0, j = 0, prev = 0;

    // start search from a particular point in the virtual buffer
    if (offset) {
        var p = this._offset(offset);
        i = p[0];
        j = p[1];
        prev = offset;
    }

    while (i < this._bufs.length) {

        var s = this._bufs[i].indexOf(needle, j);

        if (s !== -1) {
            return prev + s - j;
        }

        prev += this._bufs[i].length - j;
        i++;
        j = 0;
    }

    return -1;
};

if (!Buffer.prototype.indexOf) {

    var bindexOf = require('buffer-indexof');

    Buffer.prototype.indexOf = function (search, offset) {
        return bindexOf(this, search, offset);
    };
}

function MjpegConsumer(options) {
    if (!(this instanceof MjpegConsumer)) {
        return new MjpegConsumer(options);
    }

    Transform.call(this, options);

    this.bl = new BufferList();
}

util.inherits(MjpegConsumer, Transform);

MjpegConsumer.prototype._transform = function(chunk, encoding, done) {

    this.bl.append(chunk);

    var start = this.bl.indexOf(soi);

    var end;

    while (start !== -1) {
        end = this.bl.indexOf(eoi, start);
        if (end === -1) {
            break;
        }
        end += eoi.length;
        var image = new Buffer(end - start);
        this.bl.copy(image, 0, start, end);
        this.push(image);
        if (end === this.bl.length) {
            break;
        }
        start = this.bl.indexOf(soi, end);
    }

    if (end > 0) {
        this.bl.consume(end);
    }

    done();
};

module.exports = MjpegConsumer;
