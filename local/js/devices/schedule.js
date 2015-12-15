(function() {
  "use strict";

  angular
    .module('nHome')
    .directive('schedule', ['socket', function(socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/schedule.html',
        scope: {
          schinfo: '='
        },
        link: function(scope, elem, attr) {

          console.log(scope.schinfo);
          var timeObj, scheduledDays = [];

          /*scope.schinfo.dateTime.date = scope.schinfo.dateTime.year ? new Date(scope.schinfo.dateTime.year, scope.schinfo.dateTime.month, scope.schinfo.dateTime.day, scope.schinfo.dateTime.hour, scope.schinfo.dateTime.minute) : null;
*/


          scope.$on('updateJob', function(event, data) {

            if (scope.schinfo.id === data.id) {
              socket.emit4('updateJob', data.id, data.newName, data.newTimeObj, function(newJob) {
                if (newJob) {
                  scope.schinfo.name = data.newName;
                  scope.schinfo.dateTime = data.newTimeObj;
                }
              });
            }
          });

          var checkboxDays = document.getElementsByClassName('new-scene-day');
          /* edit schedule */
          scope.editSchedule = function(sch) {
            /* show just edit schedule window */
            scope.editMode = !scope.editMode;

            angular.forEach(sch.dateTime.dayOfWeek, function(day) {
              angular.forEach(checkboxDays, function(chbDay) {
                if (chbDay.value == day && chbDay.id.slice(14) === sch.id) {
                  chbDay.checked = true;
                }
              });
            })
          };

          scope.saveEditSchedule = function(sch) {
            scheduledDays = [];
            /* check the id of checkbox if match id od schedule */
            angular.forEach(checkboxDays, function(day) {
              if (day.checked && sch.id === day.id.slice(14)) {
                scheduledDays.push(parseInt(day.value));
              }
            });
            timeObj = {
              dayOfWeek: scheduledDays,
              hour: sch.dateTime.hour,
              minute: sch.dateTime.minute
            };
            socket.emit4('updateJob', sch.id, sch.name, timeObj, function(response) {
              sch.dateTime = timeObj;
              scope.editMode = false;
            });
          };

          scope.deleteSchedule = function(jobId) {
            socket.emit('removeJob', jobId);
          };
        }
      }
    }]);
}());
