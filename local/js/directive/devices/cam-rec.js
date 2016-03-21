(function() {
  "use strict";

  angular
    .module('services')
    .directive('camRec', ['dataService', 'socket', '$rootScope', '$state', function(dataService, socket, $rootScope, $state) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/cam-rec.html',
        scope: {
          camrec: '='
        },
        controllerAs: 'camrecCtrl',
        controller: ['$scope', function($scope) {

          var camrecCtrl = this;
          var deviceObj = $scope.camrec;
          var camrecOptions = {
              width: -1,
              height: -1,
              framerate: 1
            }
            // get camera name by id in recording
          var allCameras = dataService.getData().getDevicesObj.camera;
          angular.forEach(allCameras, function(cam) {
            if (cam.id === deviceObj.cameraid) {
              deviceObj.cameraName = cam.name;
            }
          });
          // get date of recording for filtering
          var date = new Date(deviceObj.starttime);
          deviceObj.date = date.toUTCString();
          // get api key for recording download
          camrecCtrl.apiKey = dataService.getData().getApiKey;
          if (!camrecCtrl.apiKey) {
            socket.emit('getApiKey', null, function(response) {
              camrecCtrl.apiKey = response;
            });
          }
          // get server id for recording download
          deviceObj.serverId = 0;
            // get recording thumbnail image
          socket.emit('getRecordingThumbnail', deviceObj.id, function(response) {
            deviceObj.thumbnailImg = dataService.blobToImage(response);
          });
          /**
           * @name requestPlayback
           * @desc request playback from server, if success send emit for video modal
           * @type {function}
           * @param {camrecObj} camera recording object
           */
          function requestPlayback(camrecObj) {
            socket.emit3('startPlayback', camrecObj.id, camrecOptions, function(response) {
              if (response) {
                camrecObj.playbackId = response;
                $scope.$emit('requestLiveStreamPlayback', {
                  dev: camrecObj,
                  type: 'recording',
                  options: camrecOptions
                });
              }
            });
          }
          /**
           * @name deleteRecording
           * @desc delete recording
           * @type {function}
           * @param {recId} recording id
           */
          function deleteRecording(recId) {
            socket.emit('deleteRecording', recId);
            // emit event to security ctrl
            $scope.$emit('deleteRecording', recId);
          }
          // exports
          camrecCtrl.requestPlayback = requestPlayback;
          camrecCtrl.deleteRecording = deleteRecording;
          camrecCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr) {

          var camrecActions = elem[0].querySelector('.cam-rec-actions');
          var currentState = $state.current.name;
          var deleteIcon = elem[0].querySelector('.color-red');
          // if dashboard remove delete icon
          if (currentState === 'frame.dashboard') {
            camrecActions.removeChild(deleteIcon);
          }
        }
      }
    }])
}());
