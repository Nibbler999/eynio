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
          deviceObj.serverId = JSON.parse(sessionStorage.activeServer).id;
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
          // camrecCtrl.requestPlayback = requestPlayback;
          camrecCtrl.deleteRecording = deleteRecording;
          camrecCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var dropdown = elem[0].querySelector('.dropdown-menu');
          var currentState = $state.current.name;
          var deleteIcon = elem[0].querySelector('.color-red');
          var video = elem[0].querySelector('video');
          // if dashboard remove delete icon
          if (currentState === 'frame.dashboard') {
            dropdown.removeChild(deleteIcon.parentNode);
          }
          video.src = "/" + ctrl.deviceObj.id + ".webm";
        }
      }
    }])
}());
