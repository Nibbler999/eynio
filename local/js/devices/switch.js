(function() {
  "use strict";

  angular
    .module('services')
    .directive('switch', ['dataService', '$state', 'socket', function(dataService, $state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/switch.html',
        scope: {
          sinfo: '='
        },
        link: function(scope, elem, attr) {

          scope.currentState = $state.current.name;

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

          if (scope.currentState === 'frame.devices') {
            return false;
          } else {
            /* toggle switch On/Off */
            scope.switchOn = function(devId, devVal) {
              console.log(devId);
              if (devVal === true) {
                return false;
              } else {
                socket.emit('switchOn', devId, function(argument) {
                  console.log(argument);
                });
              }
            };
            scope.switchOff = function(devId, devVal) {
              if (devVal === false) {
                return false;
              } else {
                socket.emit('switchOff', devId);
              }
            };
            scope.toggleDevicePowerState = function(devId) {
              socket.emit('toggleDevicePowerState', devId);
            };
          }
          
          /* on switchState change state */
          socket.on('switchState', function(data) {
            if (scope.sinfo.id === data.id) {
              scope.sinfo.value = data.state.on;
            };
          });
        }
      };
    }]);
}());
