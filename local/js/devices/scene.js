(function() {
  "use strict";

  angular
    .module('services')
    .directive('scene', ['socket', 'dataService', '$rootScope', '$state', function(socket, dataService, $rootScope, $state) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          scinfo: '='
        },
        templateUrl: 'directive/devices/scene.html',
        link: function(scope, elem, attr) {

          scope.currentState = $state.current.name;
          scope.deviceScheduleRepeat = 'daily';

          scope.setScene = function(sceneId) {
            socket.emit('setScene', sceneId);
          };

          scope.deleteScene = function(sceneId) {
            socket.emit('deleteScene', sceneId);
          };

          scope.editScene = function(scene) {
            $rootScope.$broadcast('editScene', scene);
          };

          // check hours to prevent schedule in the past
          scope.checkHours = function(e) {
            if (scope.deviceScheduleRepeat === 'once') {
              var date = new Date();
              e.target.min = date.getHours();
            } else {
              e.target.min = 0;
            }
          };

          // check minutes to prevent schedule in the past
          scope.checkMinutes = function(e) {
            if (scope.deviceScheduleRepeat === 'once') {
              var date = new Date();
              var h = parseInt(document.getElementById('device-schedule-hours-' + scope.scinfo.id).value);
              if (h <= date.getHours()) {
                e.target.min = date.getMinutes() + 1;
              }
            } else {
              e.target.min = 0;
            }
          };
          // add quick schedule
          scope.quickSchedule = function(dev, state) {
            var h = document.getElementById('device-schedule-hours-' + scope.scinfo.id);
            var m = document.getElementById('device-schedule-minutes-' + scope.scinfo.id);
            var date = new Date();
            date.setHours(parseInt(h.value), parseInt(m.value), 0, 0);

            var job = {
              name: dev.name,
              type: 'scene',
              dateTime: {
                dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
                hour: parseInt(h.value),
                minute: parseInt(m.value),
                sunrise: false,
                sunset: false
              },
              actions: [{
                emit_name: 'setScene',
                params: [dev.id]
              }]
            };
            if (scope.deviceScheduleRepeat === 'once') {
              job.dateTime = {
                hour: 0,
                minute: 0,
                sunrise: false,
                sunset: false,
                timestamp: Date.parse(date)
              }
            }
            console.log(job);
            socket.emit('addNewJob', job, function(response) {
              if (response) {
                scope.scheduleSuccess = true;
                h.value = '';
                m.value = '';
              }
              setTimeout(function() {
                scope.scheduleSuccess = false;
              }, 250);
            });
          };

          scope.$on('sceneEdited', function(event, newData) {
            if (scope.scinfo.id === newData.id) {
              console.log(newData);
              scope.scinfo = newData;
            }
          });
        }
      };
    }]);
}());
