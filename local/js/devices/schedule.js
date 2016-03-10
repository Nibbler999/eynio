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
        controllerAs: 'scheduleCtrl',
        controller: ['$scope', function($scope) {

          var scheduleCtrl = this;
          var deviceObj = $scope.schinfo;
          /**
           * @name deleteSchedule
           * @desc delete schedule
           * @type {function}
           * @param {scheduleId} schedule id
           */
          function deleteSchedule(scheduleId) {
            socket.emit('removeJob', scheduleId);
          }
          /**
           * @name editSchedule
           * @desc edit schedule
           * @type {function}
           * @param {updateScheduleObj} updated schedule object
           */
          function editSchedule(updateScheduleObj) {
            socket.emit('updateJob', updateScheduleObj, function(response) {
              if (response) {
                deviceObj = updateScheduleObj;
                $scope.$emit('updateSchedule', updateScheduleObj);
              }
            });
          }

          // exports
          scheduleCtrl.editSchedule = editSchedule;
          scheduleCtrl.deleteSchedule = deleteSchedule;
          scheduleCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = ctrl.deviceObj;
          // edit schedule DOM
          var scheduleDate = elem[0].querySelector('.schedule-date');
          var collapse = elem[0].querySelector('.collapse');
          var form = elem[0].querySelector('form');
          var hour = form.querySelectorAll('input[type="number"]')[0];
          var minute = form.querySelectorAll('input[type="number"]')[1];
          var days = form.querySelectorAll('input[name=day]');
          var sunset = form.querySelector('input[name=sunset]');
          var sunrise = form.querySelector('input[name=sunrise]');

          // dropdown
          var dropdown = elem[0].querySelector('.dropdown');
          // current state
          var currentState = $state.current.name;
          // hide dropdown option in dashboard
          if (currentState === 'frame.dashboard') {
            dropdown.classList.add('hidden');
          }
          /**
           * @name setScheduleDate
           * @desc print schedule days, hour, minute, date
           * @type {function}
           * @param {scheTimeObj} schedule time object
           */
          function setScheduleDate(scheTimeObj) {
            var dayStr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            var dayElem = document.createElement('p');
            var atElem = document.createElement('p');
            atElem.innerHTML = ' @ ';
            var timeElem = document.createElement('p');
            while (scheduleDate.firstChild) {
              scheduleDate.removeChild(scheduleDate.firstChild);
            }
            // if days, print them on schedule
            if (scheTimeObj.dayOfWeek) {
              // if all days are checked, print 'Daily'
              if (scheTimeObj.dayOfWeek.length === 0 || scheTimeObj.dayOfWeek.length === 7) {
                var clone = dayElem.cloneNode(true);
                clone.innerHTML = 'Daily';
                scheduleDate.appendChild(clone);
              } else {
                angular.forEach(scheTimeObj.dayOfWeek, function(dayVal, index) {
                  var clone = dayElem.cloneNode(true);
                  // if not last day in array, put ',' behid it
                  if (index === scheTimeObj.dayOfWeek.length - 1) {
                    clone.innerHTML = dayStr[dayVal];
                  } else {
                    clone.innerHTML = dayStr[dayVal] + ', ';
                  }
                  scheduleDate.appendChild(clone);
                })
              }
            }
            // if sunset or sunrise checked
            if (scheTimeObj.sunset || scheTimeObj.sunrise) {
              if (scheTimeObj.sunset) {
                timeElem.innerHTML = 'Sunset';
              } else {
                timeElem.innerHTML = 'Sunrise';
              }
            } else if(scheTimeObj.hour || scheTimeObj.minute){
              timeElem.innerHTML = scheTimeObj.hour + ':' + scheTimeObj.minute;
            } else{
              var date = new Date(scheTimeObj.timestamp);
              timeElem.innerHTML = date.toUTCString();
              atElem.innerHTML = '';
            }
            scheduleDate.appendChild(atElem);
            scheduleDate.appendChild(timeElem);
          }
          /**
           * @name checkFormInputs
           * @desc set form inputs to checked correspondingly to data
           * @type {function}
           * @param {scheTimeObj} schedule time object
           */
          function checkFormInputs(scheTimeObj) {
            if (scheTimeObj.sunrise || scheTimeObj.sunset) {
              if (scheTimeObj.sunrise) {
                sunrise.checked = true;
                sunset.disabled = true;
              } else {
                sunrise.disabled = true;
                sunset.checked = true;
              }
              // disable time inputs
              hour.disabled = true;
              minute.disabled = true;
            } else {
              hour.value = scheTimeObj.hour;
              minute.value = scheTimeObj.minute;
            }
            if (scheTimeObj.dayOfWeek) {
              angular.forEach(scheTimeObj.dayOfWeek, function(dayVal) {
                angular.forEach(days, function(day) {
                  if (dayVal == day.value) {
                    day.checked = true;
                  }
                })
              })
            }
          }
          /**
           * @name disableFormInputs
           * @desc disableing other inputs when "sunrise" or "sunset" checked
           * @type {function}
           */
          function disableFormInputs() {
            var disableCheck = this.value === 'sunset' ? sunrise : sunset;
            if (this.checked) {
              disableCheck.disabled = true;
              hour.disabled = true;
              minute.disabled = true;
            } else {
              disableCheck.disabled = false;
              hour.disabled = false;
              minute.disabled = false;
            }
            scope.$apply();
          }
          /**
           * @name sunset change
           * @desc disabled other inputs
           * @type {event}
           */
          sunset.addEventListener('change', disableFormInputs, false);
          /**
           * @name sunrise change
           * @desc disable other inputs
           * @type {type}
           */
          sunrise.addEventListener('change', disableFormInputs, false);
          /**
           * @name form
           * @desc submit edit schedule
           * @type {event}
           */
          form.addEventListener('submit', function() {
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
            time.hour = !hour.disabled ? parseInt(hour.value) : null;
            time.minute = !minute.disabled ? parseInt(minute.value) : null;
            angular.forEach(days, function(day) {
              if (day.checked && !day.disabled) {
                time.dayOfWeek.push(parseInt(day.value));
              };
            });

            var job = {
              id: deviceObj.id,
              name: deviceObj.name,
              type: deviceObj.type,
              dateTime: time,
              actions: deviceObj.actions
            }
            ctrl.editSchedule(job);
            setScheduleDate(time);
            $(collapse).collapse('hide');
          }, false);

          setScheduleDate(deviceObj.dateTime);
          checkFormInputs(deviceObj.dateTime);
        }
      }
    }]);
}());
