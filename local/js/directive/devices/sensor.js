(function() {
  "use strict";

  angular
    .module('services')
    .directive('sensor', ['dataService', '$state', 'socket', function(dataService, $state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/sensor.html',
        scope: {
          sensorinfo: '='
        },
        controllerAs: 'sensorCtrl',
        controller: ['$scope', function($scope) {

          var sensorCtrl = this;
          var deviceObj = $scope.sensorinfo;

          // listen for value changes
          socket.on('sensorValue', function(response) {
            if (deviceObj.id === response.id) {
              deviceObj.value = response.value
            }
            setDeviceIcon();
          });
          /**
           * @name setDeviceIcon
           * @desc set sensor img
           * @type {function}
           * @param {}
           */
          function setDeviceIcon() {
            switch (deviceObj.subtype) {
              case 'co-alarm':
                sensorCtrl.deviceIcon = 'img/sensors/co.png';
                break;
              case 'co2':
                sensorCtrl.deviceIcon = 'img/sensors/co2.png';
                break;
              case 'door':
                sensorCtrl.deviceIcon = deviceObj.value ? 'img/sensors/door-open.png' : 'img/sensors/door-close.png';
                break;
              case 'humidity':
                sensorCtrl.deviceIcon = 'img/sensors/humidity.png';
                break;
              case 'light':
                sensorCtrl.deviceIcon = 'img/sensors/lux.png';
                break;
              case 'motion':
                sensorCtrl.deviceIcon = 'img/sensors/motion.png';
                break;
              case 'noise':
                sensorCtrl.deviceIcon = 'img/sensors/noise.png';
                break;
              case 'pressure':
                sensorCtrl.deviceIcon = 'img/sensors/pressure.png';
                break;
              case 'rain':
                sensorCtrl.deviceIcon = 'img/sensors/rain.png';
                break;
              case 'smoke-alarm':
                sensorCtrl.deviceIcon = 'img/sensors/smoke.png';
                break;
              case 'temperature':
                sensorCtrl.deviceIcon = 'img/sensors/temp.png';
                break;
            }
          }
          setDeviceIcon();

          // exports
          sensorCtrl.deviceObj = deviceObj;
        }]
      }
    }]);
}());
