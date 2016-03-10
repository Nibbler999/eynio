(function() {
  "use strict";

  angular
    .module('nHome')
    .directive('camera', ['dataService', 'socket', function(dataService, socket) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          cinfo: '='
        },
        templateUrl: 'directive/devices/camera.html',
        controllerAs: 'cameraCtrl',
        controller: ['$scope', function($scope) {

          var cameraCtrl = this;
          var deviceObj = $scope.cinfo;

          var cameraOptions = {
            width: -1,
            height: -1,
            framerate: deviceObj.fps || 1
          };

          socket.emit('getCachedThumbnail', deviceObj.id, function(thumbnail) {
            if (!thumbnail) {
              deviceObj.thumbnailImg = false;
            } else {
              deviceObj.thumbnailImg = dataService.blobToImage(thumbnail);
            }
          });
          /**
           * @name toggleDeviceFavorites
           * @desc add or remove device from favorites
           * @type {function}
           * @param {devId, devFav} device id, favorites state
           */
          function toggleDeviceFavorites(devId, devFav) {
            if (devFav) {
              socket.emit4('setUserProperty', devId, 'favorites', true);
            } else {
              socket.emit4('setUserProperty', devId, 'favorites', false);
            }
          }
          /**
           * @name requestCameraLiveStream
           * @desc send request for live stream
           * @type {function}
           * @param {devObj} device object
           */
          function requestCameraLiveStream(devObj) {
            socket.emit('requestStreaming', devObj.id, cameraOptions);

            $scope.$emit('requestLiveStreamPlayback', {
              dev: devObj,
              type: devObj.type,
              options: cameraOptions
            });
          };
          /**
           * @name getCameraLiveThumbnail
           * @desc get live img from camera
           * @type {function}
           * @param {devId} device id
           */
          function getCameraLiveThumbnail(devId) {
            socket.emit('getLiveThumbnail', devId, function(data) {
              deviceObj.thumbnailImg = dataService.blobToImage(data);
            });
          }
          /**
           * @name refreshCameraFeed
           * @desc if no thumbnail, try again
           * @type {function}
           * @param {devId}
           */
          function refreshCameraFeed(devId) {
            socket.emit('getCachedThumbnail', devId, function(thumbnail) {
              if (!thumbnail) {
                deviceObj.thumbnailImg = false;
              } else {
                deviceObj.thumbnailImg = dataService.blobToImage(thumbnail);
              }
            });
          }
          /**
           * @name cameraRecordingOff
           * @desc stop all recordings
           * @type {function}
           * @param {devObj} device obj
           */
          function cameraRecordingOff(devObj) {
            socket.emit('disableMotionRecording', devObj.id, function(response) {
              if (response) {
                devObj.motion_recording = false;
                devObj.motion_recording_if_alarm = false;
                socket.emit('updateCamera', devObj);
              }
            });
          };
          /**
           * @name cameraRecordingMotion
           * @desc record only when motion is detected
           * @type {function}
           * @param {devObj} device object
           */
          function cameraRecordingMotion(devObj) {
            if (devObj.motion_recording) {
              devObj.motion_recording = false;
              socket.emit('updateCamera', devObj);
            } else {
              devObj.motion_recording = true;
              socket.emit('updateCamera', devObj);
            }
          };
          /**
           * @name cameraRecordingMotionOnAlarm
           * @desc record motion only if alarm is active
           * @type {function}
           * @param {devObj} device object
           */
          function cameraRecordingMotionOnAlarm(devObj) {
            if (!devObj.motion_recording_if_alarm) {
              if (!devObj.motion_recording) {
                devObj.motion_recording = true;
                devObj.motion_recording_if_alarm = true;
                socket.emit('updateCamera', devObj);
              } else {
                devObj.motion_recording_if_alarm = true;
                socket.emit('updateCamera', devObj);
              }
            } else {
              cam.motion_recording_if_alarm = false;
              socket.emit('updateCamera', cam);
            }
          };

          // exports
          cameraCtrl.toggleDeviceFavorites = toggleDeviceFavorites;
          cameraCtrl.requestCameraLiveStream = requestCameraLiveStream;
          cameraCtrl.getCameraLiveThumbnail = getCameraLiveThumbnail;
          cameraCtrl.refreshCameraFeed = refreshCameraFeed;
          cameraCtrl.cameraRecordingOff = cameraRecordingOff;
          cameraCtrl.cameraRecordingMotion = cameraRecordingMotion;
          cameraCtrl.cameraRecordingMotionOnAlarm = cameraRecordingMotionOnAlarm;
          cameraCtrl.deviceObj = deviceObj;
        }]
      };
    }])
}());
