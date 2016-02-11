/*
    From https://github.com/mmaelzer/motion
*/

/** @const {Number} **/
var DEFAULT_THRESHOLD = 0x15;
var DEFAULT_MIN_CHANGE = 10;

/**
 *  @param {Object} options
 */
function MotionDetection(options) {
  options = options || {};
  this.threshold = options.threshold || DEFAULT_THRESHOLD;
  this.minChange = options.minChange || DEFAULT_MIN_CHANGE;
  this.prevImage = null;
  this.regions = options.regions;
}
module.exports = MotionDetection;

/** 
 *  @param {Array.<Number>} img1 - flat grayscale array
 *  @param {Array.<Number>=} opt_img2 - flat grayscale array
 *  @return {Boolean}
 */
MotionDetection.prototype.detect = function(img1, opt_img2) {
  var img2 = opt_img2 || this.prevImage;
  this.prevImage = img1;
  if (!img2) {
    return false;
  }
  if (this.regions) {
    // TODO: Only test for motion in regions
  } else {
    return this.minChange < this.diff(img1, img2);
  }
};

/** 
 *  Useful for seeing what areas of the images are generating
 *  motion.
 *  @param {Array.<Number>} img1 - flat grayscale array
 *  @param {Array.<Number>} img2 - flat grayscale array 
 *  @return {Arrray.<Number>}
 */
MotionDetection.prototype.getBlendedImage = function(img1, img2) {
  var blended = [];
  if (img1.length !== img2.length) return null;
  var i = 0;
  while (i < img1.length) {
    var diff = threshold(fastAbs(img1[i] - img2[i]), this.threshold);
    blended[i] = diff;
    ++i;
  }
  return blended;
};

/** @return {Array.<Number>} **/
MotionDetection.prototype.getLastImage = function() {
  return this.prevImage;
};

/** 
 *  @param {Array.<Number>} img1 - flat grayscale array
 *  @param {Array.<Number>} img2 - flat grayscale array 
 *  @return {Number}
 */
MotionDetection.prototype.diff = function(img1, img2) {
  if (img1.length !== img2.length) return null;
  var i = 0;
  var changed = 0;
  while (i < img1.length) {
    changed += threshold(fastAbs(img1[i] - img2[i]), this.threshold);  
    ++i;
  }
  return Math.round(changed / img1.length);
};

/**
 *  @param {Number}
 *  @return {Number}
 */
function fastAbs(value) {
  return (value ^ (value >> 31)) - (value >> 31);
}

/**
 *  @param {Number} value
 *  @param {Number} minValue
 *  @return {Number}
 */
function threshold(value, minValue) {
  return (value > minValue) ? 0xFF : 0;
}
