(function() {
  "use strict";

  angular
    .module('nHome')
    .directive('camera', ['$rootScope', 'dataService', 'socket', function($rootScope, dataService, socket) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          cinfo: '='
        },
        templateUrl: 'directive/devices/camera.html',
        link: function(scope, elem, attr) {

          var recordingId;

          var options = {
            width: -1,
            height: -1,
            framerate: scope.cinfo.fps || 1
          };

          socket.emit('getCachedThumbnail', scope.cinfo.id, function(thumbnail) {
            if (!thumbnail) {
              scope.cinfo.thumbnailImg = false;
            } else {
              scope.cinfo.thumbnailImg = dataService.blobToImage(thumbnail);
            }
          });

          scope.getLiveThumbnail = function(camId) {
            socket.emit('getLiveThumbnail', camId, function(data) {
              scope.cinfo.thumbnailImg = dataService.blobToImage(data);
            });
          };

          scope.refreshFeed = function(cam) {
            if (cam.snapshot) {
              socket.emit('testStreamURL', cam.snapshot, function(response) {
                if (response) {
                  socket.emit('getCachedThumbnail', scope.cinfo.id, function(thumbnail) {
                    if (!thumbnail) {
                      scope.thumbnailImg = false;
                    } else {
                      scope.thumbnailImg = dataService.blobToImage(thumbnail);
                    }
                  });
                }
              })
            }
          };

          scope.requestLiveStream = function(cam) {
            socket.emit('requestStreaming', cam.id, options);

            $rootScope.$broadcast('requestLiveStreamPlayback', {
              dev: cam,
              type: cam.type,
              options: options
            });
          };

          scope.toggleAddToFavorites = function(favorites, devId) {
            if (favorites) {
              socket.emit4('setUserProperty', devId, 'favorites', true);
            } else {
              socket.emit4('setUserProperty', devId, 'favorites', false);
            }
          };

          scope.recOff = function(cam) {
            socket.emit('disableMotionRecording', cam.id, function(resp) {
              console.log(resp);
              if (resp) {
                cam.motion_recording = false;
                cam.motion_recording_if_alarm = false;
                socket.emit('updateCamera', cam);
              }
            });
          };

          scope.recOnMotion = function(cam) {
            if (cam.motion_recording) {
              cam.motion_recording = false;
              socket.emit('updateCamera', cam);
            } else {
              cam.motion_recording = true;
              socket.emit('updateCamera', cam);
            }
          };

          scope.recOnMotionAlarm = function(cam) {
            if (!cam.motion_recording_if_alarm) {
              if (!cam.motion_recording) {
                cam.motion_recording = true;
                cam.motion_recording_if_alarm = true;
                socket.emit('updateCamera', cam);
              } else {
                cam.motion_recording_if_alarm = true;
                socket.emit('updateCamera', cam);
              }
            } else {
              cam.motion_recording_if_alarm = false;
              socket.emit('updateCamera', cam);
            }
          };
          // scope.startRecording = function(devId) {
          //   socket.emit('startRecording', devId, function(recId) {
          //     scope.cinfo.recordingId = recId;
          //     recordingId = recId;
          //   })
          // };
          // scope.stopRecording = function() {
          //   socket.emit('stopRecording', scope.cinfo.recordingId, function(response) {
          //     console.log(response);
          //     if(response){
          //       scope.cinfo.recordingId = null;
          //     }
          //   })
          // };
        }
      };
    }])
}());
