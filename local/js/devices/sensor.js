(function() {
  "use strict";

  angular
    .module('services')
    .directive('sensor', ['dataService', '$state', 'socket', function(dataService, $state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/sensor.html',
        scope: {
          sensorinfo: '='
        },
        link: function(scope, elem, attr) {

          /* where am I */
          scope.devicesState = $state.current.name;

          var getIcon = function() {
            if (scope.sensorinfo.subtype === 'temperature') {
              scope.sensorImg = 'img/sensors/temp.png';
            } else
            if (scope.sensorinfo.subtype === 'humidity') {
              scope.sensorImg = 'img/sensors/humidity.png';
            } else
            if (scope.sensorinfo.subtype === 'co2') {
              scope.sensorImg = 'img/sensors/co.png';
            } else
            if (scope.sensorinfo.subtype === 'noise') {
              scope.sensorImg = 'img/sensors/noise.png';
            } else
            if (scope.sensorinfo.subtype === 'rain') {
              scope.sensorImg = 'img/sensors/rain.png';
            } else
            if (scope.sensorinfo.subtype === 'light') {
              scope.sensorImg = 'img/sensors/lux.png';
            } else
            if (scope.sensorinfo.subtype === 'rain') {
              scope.sensorImg = 'img/sensors/rain.png';
            } else
            if (scope.sensorinfo.subtype === 'motion') {
              scope.sensorImg = 'img/sensors/motion.png';
            } else
            if (scope.sensorinfo.subtype === 'door') {
              if (scope.sensorinfo.value) {
                scope.sensorImg = 'img/sensors/door-open.png';

              } else {
                scope.sensorImg = 'img/sensors/door-close.png';
              }
            } else
            if (scope.sensorinfo.subtype === 'pressure') {
              scope.sensorImg = 'img/sensors/pressure.png';
            } else
            if (scope.sensorinfo.subtype === 'co-alarm') {
              scope.sensorImg = 'img/sensors/co.png';
            }
          }

          getIcon();

          socket.on('sensorValue', function(newSensroVal) {
            if (scope.sensorinfo.id === newSensroVal.id) {
              scope.sensorinfo.value = newSensroVal.value
            }
            getIcon();
          });
        }
      }
    }]);
}());
