"use strict";

var stream = require('stream');
var util = require('util');
var WebMByteStream = require('webm-byte-stream');

// if the segment is more than 65k, chrome breaks
function WebMParser()
{
    stream.Transform.call(this, {objectMode: true });

    var self = this;

    this.segmenter = new WebMByteStream({durations: false});
    this.metadata = null;

    this.segmenter.on('Initialization Segment', function (data) {
        self.metadata = data;
    });

    this.segmenter.on('Media Segment', function (data) {

        var frame = {
            metadata: self.metadata,
            cluster: data.cluster
        };

        self.push(frame);
    });
}

util.inherits(WebMParser, stream.Transform);

WebMParser.prototype._transform = function () {
    this.segmenter.write.apply(this.segmenter, arguments);
};

module.exports = WebMParser;

