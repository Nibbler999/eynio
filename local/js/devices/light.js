(function() {
  "use strict";

  angular
    .module('services')
    .directive('light', ['dataService', '$state', 'socket', function(dataService, $state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/light.html',
        scope: {
          linfo: '='
        },
        link: function(scope, elem, attr) {
          /* where am I */
          scope.currentState = $state.current.name;
          scope.lightIcon = 'img/device/light-off.png';
          scope.scheduleState = false;
          scope.deviceScheduleRepeat = 'daily';

          //if no state, request it
          if (!scope.linfo.state) {
            socket.emit('getLightState', scope.linfo.id, function(state) {
              scope.linfo.state = state;
            });
          }

          scope.scheduleState = scope.linfo.state.on;
          $('#light-color').attr('id', 'light-color-' + scope.linfo.count);
          // $('#light-brightness').attr('id', 'light-brightness-' + scope.linfo.id);
          // $('#light-saturation').attr('id', 'light-saturation-' + scope.linfo.id);

          $('#light-color-' + scope.linfo.count).ColorPickerSliders({
            color: 'hsl(' + scope.linfo.state.hsl[0] + ',' + scope.linfo.state.hsl[1] + ',' + scope.linfo.state.hsl[2] + ')',
            updateinterval: 1,
            flat: true,
            swatches: false,
            order: {
              hsl: 1
            },
            labels: {
              hslhue: '',
              hslsaturation: '',
              hsllightness: ''
            },
            onchange: function(container, color) {
              scope.linfo.state.hsl[0] = color.tiny.toHsl().h;
              scope.linfo.state.hsl[1] = color.tiny.toHsl().s;
              scope.linfo.state.hsl[2] = color.tiny.toHsl().l;
            }
          });
          scope.$watch('linfo.state.on', function() {
            setIcon();
          });

          /* toggle active icon */
          function setIcon() {

            if (scope.linfo.state.on) {
              scope.lightIcon = 'img/device/light-on.png';
            } else {
              scope.lightIcon = 'img/device/light-off.png';
            }
          };

          /* set light color */
          scope.setColor = function(lightId, lightColor) {
            socket.emit4('setLightColor', lightId, lightColor, 'hsl');
          };

          /* set light to full white */
          scope.setLightWhite = function(lightId) {
            socket.emit4('setLightColor', lightId, [0, 0, 1], 'hsl');
            scope.linfo.state.hsl = [0, 0, 1];
          };

          scope.setBrightness = function(lightId, brightness) {
            socket.emit4('setLightWhite', lightId, parseInt(brightness), 100);
          };

          /* toggle light state on/off */
          scope.lightOn = function(lightId, lightState) {
            if (lightState === true) {
              return false;
            } else {
              socket.emit('setDevicePowerState', lightId, true);
            }
          };
          scope.lightOff = function(lightId, lightState) {
            if (lightState === false) {
              return false;
            } else {
              socket.emit('setDevicePowerState', lightId, false);
            }
          };
          scope.toggleDevicePowerState = function(lightId) {
            socket.emit('toggleDevicePowerState', lightId);
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
            } else {
              e.target.min = 0;
            }
          };

          // check minutes to prevent schedule in the past
          scope.checkMinutes = function(e) {
            if (scope.deviceScheduleRepeat === 'once') {
              var date = new Date();
              var h = parseInt(document.getElementById('device-schedule-hours-' + scope.linfo.id).value);
              if (h <= date.getHours()) {
                e.target.min = date.getMinutes() + 1;
              }
            } else {
              e.target.min = 0;
            }
          };
          // add quick schedule
          scope.quickSchedule = function(dev, state) {
            var h = document.getElementById('device-schedule-hours-' + scope.linfo.id);
            var m = document.getElementById('device-schedule-minutes-' + scope.linfo.id);
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
                emit_name: 'setDevicePowerState',
                params: [dev.id, state]
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

          socket.on('lightState', function(state) {
            if (scope.linfo.id === state.id) {
              scope.linfo.state = state.state;
            }
          });
        }
      };
    }]);
}());
