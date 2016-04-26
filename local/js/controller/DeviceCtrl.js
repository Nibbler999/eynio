(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DeviceCtrl', ['$scope', 'dataService', '$rootScope', 'socket', '$timeout', '$stateParams',
      function($scope, dataService, $rootScope, socket, $timeout, $stateParams) {

        var device = this;

        var contentWrapParent = document.querySelector('.frame-page-content-wrap');

        // show show add remote modal
        device.addRemote = function() {
          $scope.$emit('addNewRemote');
        };
        // show add new camera modal
        device.addCamera = function() {
          $scope.$emit('addNewCamera');
        };
        //  get data
        device.data = dataService.getData();

        if (device.data.getDevicesObj) {
          if ($stateParams.deviceType) {
            $timeout(function() {
              contentWrapParent.querySelector('#sensors-list').classList.add('in');
            }, 100);
          } else {
            // show first set of devices
            $timeout(function() {
              contentWrapParent.children[0].children[1].children[1].classList.add('in');
            }, 100);
          }
        }
        // wait on socket to connect than get data
        if (!device.data.getDevicesObj || !device.data.getBlacklisted) {
          dataService.getDevicesEmit().then(function(devices) {
            device.data.getDevicesObj = devices;
            $timeout(function() {
              console.log(contentWrapParent);
              contentWrapParent.children[0].children[1].children[1].classList.add('in');
            }, 100);
          });
          dataService.getServerEmits().then(function(){
            device.data = dataService.getData();
          });
          dataService.getCategoriesEmit();
          dataService.getScenesEmit();
          dataService.getSchedulesEmit();
          dataService.getRecordingsEmit();
          console.log(device.data);
        }
      }
    ])
}());
