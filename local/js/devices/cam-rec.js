(function() {
  "use strict";

  angular
    .module('services')
    .directive('camRec', ['dataService', 'socket', function(dataService, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/cam-rec.html',
        scope: {
          camrec: '='
        },
        link: function(scope, elem, attr) {

          socket.emit('getApiKey', null, function(apiKey) {
            scope.apiKey = apiKey;
          });
          scope.serverId = 0;


          var options = {
            width: -1,
            height: 120,
            framerate: 1,
            encoder: 'jpeg/mpeg1/vp8/vp9'
          }

          var allCameras = dataService.allDev();
          allCameras = allCameras.camera;

          angular.forEach(allCameras, function(cam) {
            if (cam.id === scope.camrec.cameraid) {
              scope.camrec.cameraName = cam.name;
            }
          });

          scope.startPlayback = function(recId) {
            socket.emit('startPlayback', options, function(response) {
              console.log(response);
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
