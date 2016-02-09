(function() {
  "use strict";

  angular
    .module('services')
    .directive('thermostat', ['dataService', '$state', '$timeout', 'socket', function(dataService, $state, $timeout, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/thermostat.html',
        scope: {
          tinfo: '='
        },
        link: function(scope, elem, attr) {

          // where am I
          scope.currentState = $state.current.name;
          scope.deviceScheduleRepeat = 'daily';

          // targete for schedule
          scope.targetForSchedule = scope.tinfo.target;

          if (scope.currentState === 'frame.devices') {
            scope.unblacklistDev = function(devId) {
              socket.emit('unblacklistDevice', devId, function(response) {
                if (response) {
                  scope.tinfo.blacklisted = false;
                }
              })
            };
            return false;
          } else {
            // themostat target temp up
            scope.tempUp = function(thermo) {
              if (thermo.target < 32) {
                return thermo.target++;
              }
            };
            // thermostat target temp down
            scope.tempDown = function(thermo) {
              if (thermo.target > 18) {
                return thermo.target--;
              }
            };
            // set temperature
            scope.setTemp = function(thermo) {
              socket.emit3('setThermostatValue', thermo.id, thermo.target, function(response) {
                if (response) {
                  scope.responseSuccess = true;

                  $timeout(function() {
                    scope.responseSuccess = false;
                  }, 1000);
                }
              });
            };
            // add/remove to favorites
            scope.toggleAddToFavorites = function(favorites, devId) {
              if (favorites) {
                socket.emit4('setUserProperty', devId, 'favorites', true);
              } else {
                socket.emit4('setUserProperty', devId, 'favorites', false);
              }
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
                var h = parseInt(document.getElementById('device-schedule-hours-' + scope.tinfo.id).value);
                if (h <= date.getHours()) {
                  e.target.min = date.getMinutes() + 1;
                }
              } else {
                e.target.min = 0;
              }
            };
            // add quick schedule
            scope.quickSchedule = function(dev, temp) {
              var h = document.getElementById('device-schedule-hours-' + scope.tinfo.id);
              var m = document.getElementById('device-schedule-minutes-' + scope.tinfo.id);
              var date = new Date();
              date.setHours(parseInt(h.value), parseInt(m.value), 0, 0);

              var job = {
                name: dev.name,
                type: 'device',
                dateTime: {
                  dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
                  hour: parseInt(h.value),
                  minute: parseInt(m.value),
                  sunrise: false,
                  sunset: false
                },
                actions: [{
                  emit_name: 'setThermostatValue',
                  params: [dev.id, temp]
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
                $timeout(function() {
                  scope.scheduleSuccess = false;
                }, 750);
              });
            };

            // quick schedule temp up
            scope.tempUpSchedule = function(temp) {
              if (temp < 32) {
                temp++;
                scope.targetForSchedule = temp;
              };
            };

            scope.tempDownSchedule = function(temp) {
              if (temp > 18) {
                temp--;
                scope.targetForSchedule = temp;
              }
            };
          }
        }
      };
    }]);
}());
