(function() {
  "use strict";

  angular
    .module('services')
    .directive('playStream', ['dataService', 'socket', function(dataService, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/playStream.html',
        controllerAs: 'playStreamCtrl',
        controller: ['$scope', function($scope) {

          var playStreamCtrl = this;
          var deviceObj;

          // liosten for camera frames
          socket.on('cameraFrame', function(liveStream) {
            if (liveStream) {
              var src = dataService.blobToImage(liveStream.image);
              if (!src) return;
              playStreamCtrl.deviceObj.dev.thumbnailImg = src;
            }
          });
          // listen for recording frames
          socket.on('recordingFrame', function(frame) {
            if (frame) {
              var src = dataService.blobToImage(frame.image);
              if (!src) return;
              playStreamCtrl.deviceObj.dev.thumbnailImg = src;
            }
          });
          /**
           * @name stopStream
           * @desc stop stream and close modal
           * @type {function}
           */
          function stopStream(streamObj) {
            if (streamObj.type === 'camera') {
              socket.emit('stopStreaming', streamObj.dev.id, streamObj.options);
            } else {
              socket.emit('endPlayback', streamObj.dev.playbackId);
            }
            deviceObj = null;
          }
          /**
           * @name arrowToggleStream
           * @desc toggle camera on arrows left or right
           * @type {function}
           * @param {oldStreamObj, newStreamDevObj} old stream object, new stream object
           */
          function arrowToggleStream(oldStreamObj, direction) {
            var allCameras = dataService.getData().getDevicesObj.camera;
            // active cam index
            var currentIndex = allCameras.indexOf(oldStreamObj.dev);
            var newStreamDevObj;
            if (direction === 'previous') {
              currentIndex -= 1;
              currentIndex = currentIndex < 0 ? allCameras.length - 1 : currentIndex;
              newStreamDevObj = allCameras[currentIndex];
            } else if (direction === 'next') {
              currentIndex += 1;
              currentIndex = currentIndex > (allCameras.length - 1) ? 0 : currentIndex;
              newStreamDevObj = allCameras[currentIndex];
            }
            socket.emit('stopStreaming', oldStreamObj.dev.id, oldStreamObj.options);
            socket.emit('requestStreaming', newStreamDevObj.id, oldStreamObj.options);
            deviceObj.dev = newStreamDevObj;
            deviceObj.options = oldStreamObj.options;
          }
          /**
           * @name initLiveStream
           * @desc initialise live stream
           * @type {function}
           * @param {streamObj} stream object with device, options and type
           */
          function initLiveStream(streamObj) {
            playStreamCtrl.deviceObj = streamObj;
            deviceObj = streamObj;
          }

          // exports
          playStreamCtrl.initLiveStream = initLiveStream;
          playStreamCtrl.arrowToggleStream = arrowToggleStream;
          playStreamCtrl.stopStream = stopStream;
          playStreamCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = ctrl.deviceObj;
          var streamModal = elem[0];
          var streamImg = elem[0].querySelector('.camera-live-stream');
          var fullScreenBtn = elem[0].querySelector('.full-screen-btn');
          var closeModalBtn = elem[0].querySelector('.close-live-stream-modal');
          var leftArrow = elem[0].querySelector('.left');
          var rightArrow = elem[0].querySelector('.right');
          // listen for stream request, show modal and initialise
          scope.$on('requestLiveStreamPlayback', function(event, camData) {
            ctrl.initLiveStream(camData);
            streamModal.style.display = 'block';
          });
          /**
           * @name fullScreenBtn
           * @desc get full screen
           * @type {event}
           */
          fullScreenBtn.addEventListener('click', function() {
            dataService.fullScreen(streamImg);
          }, false);
          /**
           * @name rightArrow
           * @desc get next camera
           * @type {event}
           */
          rightArrow.addEventListener('click', function() {
            ctrl.arrowToggleStream(ctrl.deviceObj, 'next');
          }, false);
          /**
           * @name leftArrow
           * @desc get previous camera
           * @type {event}
           */
          leftArrow.addEventListener('click', function() {
            ctrl.arrowToggleStream(ctrl.deviceObj, 'previous');
          }, false);
          /**
           * @name closeModalBtn
           * @desc close modal, stop streaming
           * @type {event}
           */
          closeModalBtn.addEventListener('click', function() {
            ctrl.stopStream(ctrl.deviceObj);
            streamModal.style.display = 'none';
          }, false);
          // listen for state change and stop stream
          scope.$on('closeModals', function(event) {
            streamModal.style.display = 'none';
            if (ctrl.deviceObj) {
              ctrl.stopStream(ctrl.deviceObj);
            }
          });
          /**
           * @name document.body
           * @desc when keyboard keys are pressd
           * @type {event}
           */
          document.body.addEventListener('keyup', function(e) {
            if (e.keyCode === 27 && ctrl.deviceObj) {
              ctrl.stopStream(ctrl.deviceObj);
              streamModal.style.display = 'none';
            } else if (e.keyCode === 37 && ctrl.deviceObj && ctrl.deviceObj.dev.type === 'camera') {
              // previous
              ctrl.arrowToggleStream(ctrl.deviceObj, 'previous');
            } else if (e.keyCode === 39 && ctrl.deviceObj && ctrl.deviceObj.dev.type === 'camera') {
              // next
              ctrl.arrowToggleStream(ctrl.deviceObj, 'next');
            }
          }, false);
        }
      };
    }])
}());
