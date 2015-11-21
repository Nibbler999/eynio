(function() {
  "use strict";

  angular
    .module('services')
    .directive('light', ['dataService', '$state', 'socket', function(dataService, $state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/light.html',
        scope: {
          linfo: '='
        },
        link: function(scope, elem, attr) {


          /* where am I */
          scope.currentState = $state.current.name;
          scope.lightIcon = 'img/device/light-off.png';

          $('#light-color').attr('id', 'light-color-' + scope.linfo.count);
          $('#light-brightness').attr('id', 'light-brightness-' + scope.linfo.count);
          $('#light-saturation').attr('id', 'light-saturation-' + scope.linfo.count);

          socket.emit('getLightState', scope.linfo.id, function(state) {
            scope.linfo.state = state;

            $("#light-color-" + scope.linfo.count).ColorPickerSliders({
              color: scope.linfo.state.hex,
              updateinterval: 1,
              flat: true,
              swatches: false,
              order: {
                hsl: 1
              },
              labels: {
                hslhue: '',
                hslsaturation: '',
                hsllightness: ''
              },
              onchange: function(container, color) {
                scope.linfo.state.hex = color.tiny.toHex();
              }
            });
            scope.$watch('linfo.state.on', function() {
              setIcon();
            });
          });

          /* toggle active icon */
          function setIcon() {

            if (scope.linfo.state.on) {
              scope.lightIcon = 'img/device/light-on.png';
            } else {
              scope.lightIcon = 'img/device/light-off.png';
            }
          };

          if (scope.currentState === 'frame.devices') {
            return false;
          } else {

            /* set light color */
            scope.setColor = function(lightId, lightColor) {
              console.log(lightColor);
              socket.emit4('setLightColor', lightId, lightColor, 'hex');
            };

            /* set light to full white */
            scope.setLightWhite = function(lightId) {
              socket.emit('setLightWhite', lightId, 100, 1);
            };

            /* toggle light state on/off */
            scope.lightOn = function(lightId, lightState) {
              if (lightState === true) {
                return false;
              } else {
                socket.emit('setDevicePowerState', lightId, true);
              }
            };
            scope.lightOff = function(lightId, lightState) {
              if (lightState === false) {
                return false;
              } else {
                socket.emit('setDevicePowerState', lightId, false);
              }
            };
            scope.toggleDevicePowerState = function(lightId) {
              socket.emit('toggleDevicePowerState', lightId);
            };
          }

          socket.on('lightState', function(state) {
            if (scope.linfo.id === state.id) {
              scope.linfo.state = state.state;
            }
          });
        }
      };
    }]);
}());
