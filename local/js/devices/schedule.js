(function() {
  "use strict";

  angular
    .module('nHome')
    .directive('schedule', ['socket', '$state', function(socket, $state) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/schedule.html',
        scope: {
          schinfo: '='
        },
        link: function(scope, elem, attr) {

          scope.currentState = $state.current.name;
          scope.isNumber = angular.isNumber;

          var days = document.getElementsByName('day-' + scope.schinfo.id);
          var time = document.getElementsByName('time');
          var sunset = elem[0].querySelector('.sunset');
          var sunrise = elem[0].querySelector('.sunrise');

          scope.disableInputs = function(e) {

            var time = document.getElementsByClassName('form-number');
            var disableCheck = e.target.value === 'sunset' ? sunrise : sunset;
            if (e.target.checked) {
              disableCheck.disabled = true;
              angular.forEach(time, function(timeInp) {
                timeInp.disabled = true;
              });
              angular.forEach(days, function(day) {
                day.disabled = true;
              });
            } else {
              disableCheck.disabled = false;
              angular.forEach(time, function(timeInp) {
                timeInp.disabled = false;
              });
              angular.forEach(days, function(day) {
                day.disabled = false;
              });
            }
          };

          scope.editSchedule = function(sch) {
            var time = {
              dayOfWeek: [],
              hour: 0,
              minute: 0,
              sunrise: false,
              sunset: false,
              timestamp: 0
            };
            time.sunrise = !sunrise.disabled && sunrise.checked ? true : false;
            time.sunset = !sunset.disabled && sunset.checked ? true : false;
            time.hour = scope.schinfo.dateTime.hour;
            time.minute = scope.schinfo.dateTime.minute;
            angular.forEach(days, function(day) {
              if (day.checked && !day.disabled) {
                time.dayOfWeek.push(parseInt(day.value));
              };
            });

            var job = {
              id: sch.id,
              name: sch.name,
              type: sch.type,
              dateTime: time,
              actions: sch.actions
            }
            socket.emit('updateJob', job, function(scheduleObj) {
              console.log(scheduleObj);
              if (scheduleObj) {
                scope.schinfo = job;
                $('#edit-schedule-menu-' + scope.schinfo.id).collapse('hide');
              }
            });
          };

          scope.deleteSchedule = function(jobId) {
            socket.emit('removeJob', jobId);
          };
        }
      }
    }]);
}());
