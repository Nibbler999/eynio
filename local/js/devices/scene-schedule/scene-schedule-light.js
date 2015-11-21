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

          socket.emit('getLightState', scope.linfo.id, function(state) {
            scope.linfo.state = state;
            scope.linfo.scene_select = false;
            scope.linfo.schedule_select = false;
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
        }
      };
    }]);
}());
