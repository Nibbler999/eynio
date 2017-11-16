"use strict";

var util = require('util');
var stream = require('stream');
var mp4 = require('mp4-stream');
var Buffer = require('safe-buffer').Buffer;
var Box = require('mp4-box-encoding');

function FragmentParser()
{
    stream.Transform.call(this, {objectMode: true });

    var self = this;

    this.segmenter = mp4.decode();
    this.metadata = null;

    this.data = [];
    this.init = [];
    this.moov = [];

    this.mimetype = '';

    this.segmenter.on('box', function (headers) {

        var hdr = Buffer.allocUnsafe(8);
        hdr.writeUInt32BE(headers.length, 0);
        hdr.write(headers.type, 4, 4, 'ascii');

        switch (headers.type) {

        case 'ftyp':
            self.init.push(hdr);
            this.stream().on('data', function (chunk) {
                self.init.push(chunk)
            });
            break;
        case 'moov':
            self.init.push(hdr);
            self.moov.push(hdr);
            this.stream().on('data', function (chunk) {
                self.init.push(chunk);
                self.moov.push(chunk);
            }).on('end', function () {
                self.metadata = Buffer.concat(self.init);
                self.mimetype = self._getMimetype();
                self.moov = [];
                self.init = [];
            });
            break;
        case 'moof':
            self.data.push(hdr);
            this.stream().on('data', function (chunk) {
                self.data.push(chunk);
            });
            break;
        case 'mdat':
            self.data.push(hdr);
            this.stream().on('data', function (chunk) {
                self.data.push(chunk)
            }).on('end', function () {
                var frame = {
                    mimetype: self.mimetype,
                    metadata: self.metadata,
                    cluster: Buffer.concat(self.data)
                };
                self.push(frame);
                self.data = [];
            });
            break;
        default:
            this.ignore();
        }
    });
}

util.inherits(FragmentParser, stream.Transform);

FragmentParser.prototype._transform = function () {
    this.segmenter.write.apply(this.segmenter, arguments);
};

FragmentParser.prototype._getMimetype = function () {

    var entry, videoCodec = '', audioCodec = '';

    var moov = Box.decode(Buffer.concat(this.moov));

    for (var i = 0; i < moov.traks.length; i++) {
        entry = moov.traks[i].mdia.minf.stbl.stsd.entries[0];
        if (entry.type === 'avc1') {
            videoCodec = 'avc1.' + entry.avcC.mimeCodec;
        } else if (entry.type === 'mp4a') {
            audioCodec = ', mp4a.' + entry.esds.mimeCodec;
        } else {
            this.emit('error', new Error('Unsupported codec - ' + entry.type));
        }
    }

    return 'video/mp4; codecs="' + videoCodec + audioCodec + '"';
};

module.exports = FragmentParser;

