var util = require('util');
var Transform = require('stream').Transform;

// Start of Image
var soi = new Buffer(2);
soi.writeUInt16LE(0xd8ff, 0);

// End of Image
var eoi = new Buffer(2);
eoi.writeUInt16LE(0xd9ff, 0);

var Buffers = require('buffers');

Buffers.prototype.indexOf = function (needle, offset) {

    if (!needle.length) {
        return 0;
    }

    if (!this.length) {
        return -1;
    }

    var i = 0, j = 0, prev = 0;

    // start search from a particular point in the virtual buffer
    if (offset) {
        var p = this.pos(offset);
        i = p.buf;
        j = p.offset;
        prev = offset;
    }

    while (i < this.buffers.length) {

        var s = this.buffers[i].indexOf(needle, j);

        if (s !== -1) {
            return prev + s - j;
        }

        prev += this.buffers[i].length - j;
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
};

function MjpegConsumer(options) {
  if (!(this instanceof MjpegConsumer)) {
      return new MjpegConsumer(options);
  }

  Transform.call(this, options);

  this.buffers = Buffers();

}
util.inherits(MjpegConsumer, Transform);

MjpegConsumer.prototype._transform = function(chunk, encoding, done) {

  this.buffers.push(chunk);

  var start = this.buffers.indexOf(soi);

  if (start === -1) {
    done();
    return;
  }
 
  var end;
 
  while (start !== -1) {
    end = this.buffers.indexOf(eoi, start);
    if (end === -1) {
      break;
    }
    end += eoi.length;
    var image = new Buffer(end - start);
    this.buffers.copy(image, 0, start, end);
    this.push(image);
    if (end === this.buffers.length) {
      break;
    }
    start = this.buffers.indexOf(soi, end);
  }

  this.buffers.splice(0, end);

  done();
};

module.exports = MjpegConsumer;
