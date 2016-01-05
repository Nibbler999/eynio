(function() {
  "use strict";

  angular
    .module('services')
    .directive('ssLight', ['$state', 'socket', function($state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/scene-schedule-dev/sce-sch-light.html',
        scope: {
          linfo: '='
        },
        link: function(scope, elem, attr) {

          /* where am I */
          scope.currentState = $state.current.name;
          scope.lightIcon = 'img/device/light-off.png';

          //$('#light-color').attr('id', 'light-color-' + scope.linfo.id);
          $('#light-brightness').attr('id', 'light-brightness-' + scope.linfo.id);
          $('#light-saturation').attr('id', 'light-saturation-' + scope.linfo.id);

          socket.emit('getLightState', scope.linfo.id, function(state) {
            scope.linfo.state = state;
            $('#light-color-' + scope.linfo.count).ColorPickerSliders({
              color: 'hsl(' + state.hsl[0] + ',' + state.hsl[1] + ',' + state.hsl[2] + ')',
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
                scope.linfo.state.hsl[0] = color.tiny.toHsl().h;
                scope.linfo.state.hsl[1] = color.tiny.toHsl().s;
                scope.linfo.state.hsl[2] = color.tiny.toHsl().l;
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

          scope.$watch('linfo.state.on', function() {
            setIcon();
          });


          scope.deviceStateToggle = function(dev) {
            dev.state.on = !dev.state.on;
            scope.$emit('deviceAction', dev, 'setDevicePowerState', dev.state.on);
          };

          scope.deviceStateOn = function(dev) {
            dev.state.on = true;
            scope.$emit('deviceAction', dev, 'setDevicePowerState', dev.state.on);
          };

          scope.deviceStateOff = function(dev) {
            dev.state.on = false;
            scope.$emit('deviceAction', dev, 'setDevicePowerState', dev.state.on);
          };

          scope.deviceSetWhite = function(dev){
            dev.state.on = true;
            scope.$emit('deviceAction', dev, 'setLightWhite', 100, 0);
          };

          scope.deviceSetColor = function(dev, color){
            dev.state.on = true;
            scope.$emit('deviceAction', dev, 'setLightColor', color, 'hsl')
          }
        }
      };
    }]);
}());
