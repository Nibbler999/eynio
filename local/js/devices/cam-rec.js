(function() {
  "use strict";

  angular
    .module('services')
    .directive('camRec', ['dataService', 'socket', '$rootScope', '$state', function(dataService, socket, $rootScope, $state) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/cam-rec.html',
        scope: {
          camrec: '='
        },
        link: function(scope, elem, attr) {
scope.currentState = $state.current.name;
          scope.apiKey = dataService.getData().getApiKey;
          if (!scope.apiKey) {
            socket.emit('getApiKey', null, function(key) {
              scope.apiKey = key;
            });
          }

          socket.emit('getRecordingThumbnail', scope.camrec.id, function(response) {
            scope.camrec.thumbnailImg = dataService.blobToImage(response);
          });

          scope.serverId = 0;
          var options = {
            width: -1,
            height: -1,
            framerate: 1
          }

          var allCameras = dataService.getData().getDevicesObj.camera;

          angular.forEach(allCameras, function(cam) {
            if (cam.id === scope.camrec.cameraid) {
              scope.camrec.cameraName = cam.name;
            }
          });

          scope.startPlayback = function(rec) {
            socket.emit3('startPlayback', rec.id, options, function(response) {
              if (response) {
                $rootScope.$broadcast('requestLiveStreamPlayback', {
                  dev: rec,
                  type: 'recording',
                  options: options
                });
              }
            });
          };

          scope.endPlayback = function(recId) {
            socket.emit('endPlayback', recId, function(response) {
              console.log(response);
            });
          };

          scope.deleteRecording = function(recId) {
            socket.emit('deleteRecording', recId, function(response) {
              console.log(response);
            });
          };
        }
      }
    }])
}());
