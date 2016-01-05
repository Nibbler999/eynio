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
          scope.isNumber = angular.isNumber;

          var days = document.getElementsByName('day-' + scope.schinfo.id);
          var time = document.getElementsByName('time');
          var sunset = document.getElementsByName('sunset')[0];
          var sunrise = document.getElementsByName('sunrise')[0];

          scope.disableInputs = function(e) {
            var time = document.getElementsByClassName('form-number');
            var disableCheck = e.target.value === 'sunset' ? sunrise : sunset;
            if (e.target.checked) {
              disableCheck.disabled = true;
              angular.forEach(time, function(timeInp) {
                timeInp.disabled = true;
              });
              angular.forEach(days, function(day){
                day.disabled = true;
              });
            } else{
              disableCheck.disabled = false;
              angular.forEach(time, function(timeInp) {
                timeInp.disabled = false;
              });
              angular.forEach(days, function(day){
                day.disabled = false;
              });
            }
          };

          scope.editSchedule = function(sch){
            var time;
            time = sunset.checked && !sunset.disabled ? sunset.value : sunrise.checked && !sunrise.disabled ? sunrise.value : null;
            if(!time){
              time = {};
              time.dayOfWeek = [];
              angular.forEach(days, function(day){
                if(day.checked &&  !day.disabled){
                  time.dayOfWeek.push(parseInt(day.value));
                };
              });
              time.hour = scope.schinfo.dateTime.hour;
              time.minute = scope.schinfo.dateTime.minute;
            }

            var job = {
              id: sch.id,
              name: sch.name,
              type: sch.type,
              dateTime: time,
              actions: sch.actions
            }

            socket.emit('updateJob', job, function(scheduleObj){
              console.log(scheduleObj);
              if(scheduleObj){
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
