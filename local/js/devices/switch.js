(function() {
  "use strict";

  angular
    .module('services')
    .directive('switch', ['dataService', '$state', 'socket', function(dataService, $state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/switch.html',
        scope: {
          sinfo: '='
        },
        link: function(scope, elem, attr) {

          scope.currentState = $state.current.name;
          scope.deviceSchedule = false;
          scope.scheduleState = scope.sinfo.value;
          scope.deviceScheduleRepeat = 'daily';

          /* toggle active icon */
          function setIcon() {
            if (scope.sinfo.value === true) {
              scope.switchIcon = 'img/device/switch-on.png';
            } else {
              scope.switchIcon = 'img/device/switch-off.png';
            }
          };

          scope.$watch('sinfo.value', function() {
            setIcon();
          });

          if (scope.currentState === 'frame.devices') {

            scope.unblacklistDev = function(devId) {
              socket.emit('unblacklistDevice', devId, function(response) {
                if (response) {
                  scope.sinfo.blacklisted = false;
                }
              })
            };
            return false;
          } else {
            /* toggle switch On/Off */
            scope.switchOn = function(devId, devVal) {
              console.log(devId);
              if (devVal === true) {
                return false;
              } else {
                socket.emit('switchOn', devId, function(argument) {
                  console.log(argument);
                });
              }
            };
            scope.switchOff = function(devId, devVal) {
              if (devVal === false) {
                return false;
              } else {
                socket.emit('switchOff', devId);
              }
            };
            scope.toggleDevicePowerState = function(devId) {
              socket.emit('toggleDevicePowerState', devId);
            };

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
              }
            };

            // check minutes to prevent schedule in the past
            scope.checkMinutes = function(e) {
              if (scope.deviceScheduleRepeat === 'once') {
                var date = new Date();
                var h = parseInt(document.getElementById('device-schedule-hours-' + scope.sinfo.id).value);
                if (h <= date.getHours()) {
                  e.target.min = date.getMinutes() + 1;
                }
              }
            };
            // make quick schedule
            scope.quickSchedule = function(dev, state) {
              var h = document.getElementById('device-schedule-hours-' + scope.sinfo.id);
              var m = document.getElementById('device-schedule-minutes-' + scope.sinfo.id);
              var date = new Date();
              date.setHours(parseInt(h.value), parseInt(m.value), 0, 0);

              var job = {
                name: dev.name,
                type: 'device',
                dateTime: {
                  hour: parseInt(h.value),
                  minute: parseInt(m.value)
                },
                actions: [{
                  emit_name: 'setDevicePowerState',
                  params: [dev.id, state]
                }]
              };
              if (scope.deviceScheduleRepeat === 'once') {
                job.dateTime = Date.parse(date);
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

          /* on switchState change state */
          socket.on('switchState', function(data) {
            if (scope.sinfo.id === data.id) {
              scope.sinfo.value = data.state.on;
            };
          });
        }
      };
    }]);
}());
