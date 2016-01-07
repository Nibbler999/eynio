(function() {
  "use strict";

  angular
    .module('services')
    .directive('sSwitch', [function() {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/scene-schedule-dev/scene-switch.html',
        scope: {
          sinfo: '='
        },
        link: function(scope, elem, attr) {

          /* toggle active icon */
          function setIcon() {
            if (scope.sinfo.value === true) {
              scope.switchIcon = 'img/device/switch-on.png';
            } else {
              scope.switchIcon = 'img/device/switch-off.png';
            }
          };

          scope.$watch('sinfo.value', function() {
            setIcon();
          });

          scope.deviceStateToggle = function(dev){
            dev.value = !dev.value;
            scope.$emit('deviceAction', dev, 'setDevicePowerState', dev.value);
          };

          scope.deviceStateOn = function(dev){
            dev.value = true;
            scope.$emit('deviceAction', dev, 'setDevicePowerState', dev.value);
          };

          scope.deviceStateOff = function(dev){
            dev.value = false;
            scope.$emit('deviceAction', dev, 'setDevicePowerState', dev.value);
          };
        }
      };
    }]);
}());
