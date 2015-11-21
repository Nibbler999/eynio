(function() {
  "use strict";

  angular
    .module('services')
    .directive('alarm', ['socket', function(socket) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          ainfo: '='
        },
        templateUrl: 'directive/devices/alarm.html',
        link: function(scope, elem, attrs) {

          var alarmDevices = [];
          scope.alarmIcon = 'img/device/alarm-off.png';

          socket.emit('getAlarmConfig', null, function(alarmConf) {
            angular.forEach(alarmConf.devices, function(alarmDev) {
              if (alarmDev === scope.ainfo.id) {
                scope.added = true;
                scope.alarmIcon = 'img/device/alarm-on.png';
              }
            })
          });

          scope.$on('sensorRemoved', function(event, id) {
            if (id === scope.ainfo.id) {
              scope.added = false;
              scope.alarmIcon = 'img/device/alarm-off.png';
            }
          });
          scope.$on('sensorAdded', function(event, id) {
            if (id === scope.ainfo.id) {
              scope.added = true;
              scope.alarmIcon = 'img/device/alarm-on.png';
            }
          });
        }
      };
    }]);
}());
