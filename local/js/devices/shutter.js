(function() {
  "use strict";

  angular
    .module('services')
    .directive('shutter', ['$state', '$timeout', 'socket', function($state, $timeout, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/shutter.html',
        scope: {
          shinfo: '='
        },
        link: function(scope, elem, attr) {

          /* where am I */
          scope.currentState = $state.current.name;
          scope.shutterIcon = scope.shinfo.value < 50 ? 'img/device/shutter-on.png' : 'img/device/shutter-off.png';
          scope.shutterState = scope.shinfo.value < 50 ? 'open' : 'close';
          scope.deviceScheduleRepeat = 'daily';

          if (scope.currentState === 'frame.devices') {
            return false;
          } else {
            // fully open chutters
            scope.openShutter = function(shutter) {
              socket.emit('openShutter', shutter.id, function(response) {
                if (response) {
                  scope.openSuccess = true;

                  $timeout(function() {
                    scope.openSuccess = false;
                  }, 850);
                }
              });
            };
            // fully close shutter
            scope.closeShutter = function(shutter) {
              socket.emit('closeShutter', shutter.id, function(response) {
                if (response) {
                  scope.closeSuccess = true;

                  $timeout(function() {
                    scope.closeSuccess = false;
                  }, 850);
                }
              });
            };
            // stop shutter at given time
            scope.stopShutter = function(shutter) {
              socket.emit('stopShutter', shutter.id, function(shutterObj) {
                console.log(shutterObj);
                if (shutterObj) {
                  scope.shinfo.value = parseInt(shutterObj.value);
                  scope.stopSuccess = true;
                  console.log(scope.stopSuccess);

                  $timeout(function() {
                    scope.stopSuccess = false;
                  }, 850);
                }
              });
            };

            scope.toggleAddToFavorites = function(favorites, devId) {
              console.log(favorites, devId);
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
                var h = parseInt(document.getElementById('device-schedule-hours-' + scope.shinfo.id).value);
                if (h <= date.getHours()) {
                  e.target.min = date.getMinutes() + 1;
                }
              } else {
                e.target.min = 0;
              }
            };
            // add quick schedule
            scope.quickSchedule = function(dev, state) {
              var h = document.getElementById('device-schedule-hours-' + scope.shinfo.id);
              var m = document.getElementById('device-schedule-minutes-' + scope.shinfo.id);
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
                  emit_name: state === 'open' ? 'openShutter' : 'closeShutter',
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
          }
        }
      }
    }]);
}());
