"use strict";

var stream = require('stream');
var util = require('util');
var WebMByteStream = require('webm-byte-stream');

// if the segment is more than 65k, chrome breaks
function WebMParser()
{
    stream.Duplex.call(this, {objectMode: true });

    var self = this;

    this.segmenter = new WebMByteStream({durations: false});

    this.segmenter.on('Initialization Segment', function (data) {
        this.metadata = data;
    });

    this.segmenter.on('Media Segment', function (data) {

        var frame = {
            metadata: this.metadata,
            cluster: data.cluster
        };

        self.push(frame);
    });
}

util.inherits(WebMParser, stream.Duplex);

WebMParser.prototype._read = function () { };

WebMParser.prototype._write = function (chunk, encoding, next) {
    this.segmenter.write(chunk);
    next();
};

module.exports = WebMParser;

