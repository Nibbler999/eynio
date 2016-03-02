(function() {
  "use strict";

  angular
    .module('services')
    .directive('playStream', ['dataService', 'socket', function(dataService, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/playStream.html',
        link: function(scope, elem, attr) {

          var streamModal = elem[0];
          var streamImg = elem[0].querySelector('.camera-live-stream');
          var data = dataService.getData();
          var camIndex;
          /* Live stream */
          scope.$on('requestLiveStreamPlayback', function(event, camData) {
            scope.streamObj = camData;
            streamModal.style.display = 'block';

            if (!data.getDevicesObj) {
              data = dataService.getData();
            }
            angular.forEach(data.getDevicesObj.camera, function(cam, index) {
              if (cam.id === scope.streamObj.dev.id) {
                camIndex = index;
              }
            })
          });

          scope.stopStream = function() {
            if (scope.streamObj.type === 'camera') {
              socket.emit('stopStreaming', scope.streamObj.dev.id, scope.streamObj.options);
            } else {
              socket.emit('endPlayback', scope.streamObj.dev.playbackId);
            }
            // liveStreamModal.style.display = 'none';
            streamModal.style.display = 'none';
            scope.streamObj = null;
          }
          scope.fullScreen = function() {
            dataService.fullScreen(streamImg);
          }
          scope.nextCamera = function() {
            camIndex += 1;
            camIndex = camIndex > (data.getDevicesObj.camera.length - 1) ? 0 : camIndex;
            socket.emit('stopStreaming', scope.streamObj.dev.id, scope.streamObj.options);
            socket.emit('requestStreaming', data.getDevicesObj.camera[camIndex].id, scope.streamObj.options);
            scope.streamObj.dev = data.getDevicesObj.camera[camIndex];
          }
          scope.previousCamera = function() {
            camIndex -= 1;
            camIndex = camIndex < 0 ? data.getDevicesObj.camera.length - 1 : camIndex;
            socket.emit('stopStreaming', scope.streamObj.dev.id, scope.streamObj.options);
            socket.emit('requestStreaming', data.getDevicesObj.camera[camIndex].id, scope.streamObj.options);
            scope.streamObj.dev = data.getDevicesObj.camera[camIndex];
          }

          socket.on('cameraFrame', function(liveStream) {
            if (liveStream) {
              var src = dataService.blobToImage(liveStream.image);
              if (!src) return;
              scope.streamObj.dev.thumbnailImg = src;
            }
          });
          socket.on('recordingFrame', function(frame) {
            if (frame) {
              var src = dataService.blobToImage(frame.image);
              if (!src) return;
              scope.streamObj.dev.thumbnailImg = src;
            }
          });

          scope.$on('closeModals', function(event) {
            if (scope.streamObj) {
              scope.stopStream();
            }
          });
          document.body.onkeyup = function(e) {
            if (e.keyCode === 27 && scope.streamObj) {
              scope.stopStream();
            } else if (e.keyCode === 37 && scope.streamObj && scope.streamObj.dev.type === 'camera') {
              // previous
              scope.previousCamera()
            } else if (e.keyCode === 39 && scope.streamObj && scope.streamObj.dev.type === 'camera') {
              // next
              scope.nextCamera()
            }
          };
        }
      };
    }])
}());
