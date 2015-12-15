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
          scope.deviceSchedule = false;
          scope.scheduleState = false;

          $('#light-color').attr('id', 'light-color-' + scope.linfo.count);
          $('#light-brightness').attr('id', 'light-brightness-' + scope.linfo.count);
          $('#light-saturation').attr('id', 'light-saturation-' + scope.linfo.count);

          socket.emit('getLightState', scope.linfo.id, function(state) {
            scope.linfo.state = state;
            scope.scheduleState = state.on;

            $("#light-color-" + scope.linfo.count).ColorPickerSliders({
              color: 'hsl(' + state.hsl[0] + ',' + state.hsl[1] + ',' + state.hsl[2] + ')',
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
          });

          /* toggle active icon */
          function setIcon() {

            if (scope.linfo.state.on) {
              scope.lightIcon = 'img/device/light-on.png';
            } else {
              scope.lightIcon = 'img/device/light-off.png';
            }
          };

          scope.unblacklistDev = function(devId) {
            socket.emit('unblacklistDevice', devId, function(response) {
              if (response) {
                scope.linfo.blacklisted = false;
              }
            })
          };

          if (scope.currentState === 'frame.devices') {
            return false;
          } else {

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
              var date = new Date();
              e.target.min = date.getHours();
            };

            // check minutes to prevent schedule in the past
            scope.checkMinutes = function(e) {
              var date = new Date();
              var h = parseInt(document.getElementById('device-schedule-hours-' + scope.linfo.id).value);
              if (h <= date.getHours()) {
                e.target.min = date.getMinutes() + 1;
              }
            };
            scope.quickSchedule = function(dev, state) {
              var h = document.getElementById('device-schedule-hours-' + scope.linfo.id);
              var m = document.getElementById('device-schedule-minutes-' + scope.linfo.id);
              var date = new Date();
              date.setHours(parseInt(h.value), parseInt(m.value), 0, 0);

              var job = {
                name: dev.name,
                type: 'device',
                dateTime: Date.parse(date),
                actions: [{
                  emit_name: 'setDevicePowerState',
                  params: [dev.id, state]
                }]
              };
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

          socket.on('lightState', function(state) {
            if (scope.linfo.id === state.id) {
              scope.linfo.state = state.state;
            }
          });
        }
      };
    }]);
}());
