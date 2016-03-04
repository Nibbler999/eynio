(function() {
  "use strict";

  angular
    .module('services')
    .directive('light', ['$state', 'dataService', 'socket', function($state, dataService, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/light.html',
        scope: {
          linfo: '='
        },
        controllerAs: 'lightCtrl',
        controller: ['$scope', function($scope) {

          var lightCtrl = this;
          var deviceObj = $scope.linfo;

          lightCtrl.scheduleState = deviceObj.state.on || false;
          lightCtrl.deviceScheduleRepeat = 'daily';

          // if no state, request it
          if (!deviceObj.state) {
            socket.emit('getLightState', deviceObj.id, function(state) {
              deviceObj.state = state;
            });
          }
          // listen for state change
          socket.on('lightState', function(newState) {
            if (deviceObj.id === newState.id) {
              deviceObj.state = newState.state;
              setDeviceIcon();
            }
          });
          /**
           * @name setDeviceIcon
           * @desc set device icon depending on state
           * @type {function}
           * @param {}
           */
          function setDeviceIcon() {
            if (deviceObj.state.on) {
              lightCtrl.deviceIcon = 'img/device/light-on.png';
            } else {
              lightCtrl.deviceIcon = 'img/device/light-off.png';
            }
          }
          /**
           * @name toggleDevicePowerState
           * @desc switch between power states
           * @type {function}
           * @param {devId} device id
           */
          function toggleDevicePowerState(devId) {
            socket.emit('toggleDevicePowerState', devId);
          }
          /**
           * @name setDevicePowerState
           * @desc set device power state, true/false
           * @type {function}
           * @param {devId, state} device id, state true/false
           */
          function setDevicePowerState(devId, state) {
            socket.emit('setDevicePowerState', devId, state);
          }
          /**
           * @name toggleDeviceFavorites
           * @desc add or remove device from favorites
           * @type {function}
           * @param {devId, devFav} device id, favorites state
           */
          function toggleDeviceFavorites(devId, devFav) {
            if (devFav) {
              socket.emit4('setUserProperty', devId, 'favorites', true);
            } else {
              socket.emit4('setUserProperty', devId, 'favorites', false);
            }
          }
          /**
           * @name setDeviceWhite
           * @desc set light color to white
           * @type {function}
           * @param {devId} device id
           */
          function setDeviceWhite(devId) {
            socket.emit4('setLightColor', devId, [0, 0, 1], 'hsl');
          }
          /**
           * @name setlightColor
           * @desc set light color to preferred
           * @type {function}
           * @param {devId, color} device id, color in hsl format
           */
          function setlightColor(devId, color) {
            socket.emit4('setLightColor', devId, color, 'hsl');
          }
          /**
           * @name setLightBrightness
           * @desc set light brightness
           * @type {function}
           * @param {devId, brightnessLvl} device id, brightness level 0-100
           */
          function setLightBrightness(devId, brightnessLvl) {
            socket.emit4('setLightWhite', lightId, parseInt(brightness), 100);
          }
          /**
           * @name setDeviceQuickSchedule
           * @desc schedule action
           * @type {function}
           * @param {scheduleObj} generated schedule obj from link function
           */
          function setDeviceQuickSchedule(scheduleObj) {
            return socket.emit('addNewJob', scheduleObj, function(response) {
              console.log(response);
              return response
            });
          }

          setDeviceIcon();

          // exports
          lightCtrl.toggleDevicePowerState = toggleDevicePowerState;
          lightCtrl.setDevicePowerState = setDevicePowerState;
          lightCtrl.toggleDeviceFavorites = toggleDeviceFavorites;
          lightCtrl.setDeviceWhite = setDeviceWhite;
          lightCtrl.setlightColor = setlightColor;
          lightCtrl.setBrightness = setLightBrightness;
          lightCtrl.setDeviceQuickSchedule = setDeviceQuickSchedule;
          lightCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = ctrl.deviceObj;
          // device schedule DOM elements
          var deviceScheduleBtn = elem[0].querySelector('#device-schedule-btn');
          var deviceScheduleTab = elem[0].querySelector('#device-schedule-tab');
          var deviceScheduleClose = deviceScheduleTab.querySelector('.close-device-options');
          var deviceScheduleForm = elem[0].querySelector('form');
          var hour = deviceScheduleForm.querySelectorAll('input[type="number"]')[0];
          var minute = deviceScheduleForm.querySelectorAll('input[type="number"]')[1];
          // device options DOM
          var deviceOptionsToggle = elem[0].querySelector('#device-options-toggle');
          var deviceOptionsPanel = elem[0].querySelector('.device-options');
          var deviceOptions = deviceOptionsPanel.querySelectorAll('div');
          var deviceOptionsColorPicker = deviceOptions[0];
          var deviceColorPickerWrap = elem[0].querySelector('#device-color-picker-wrap');
          var deviceColorPickerClose = deviceColorPickerWrap.querySelector('.close-device-options');
          var deviceColorPicker = deviceColorPickerWrap.querySelector('#color-picker');
          var deviceOptionsBrightness = deviceOptions[1];
          var deviceBrightness = elem[0].querySelector('#device-brightness');
          var deviceBrightnessClose = deviceBrightness.querySelector('.close-device-options');

          /**
           * @name deviceOptionsToggle
           * @desc  toggle display otpions panel
           * @type {event}
           */
          deviceOptionsToggle.addEventListener('click', function() {
            deviceOptionsPanel.classList.toggle('hidden');
          }, false);
          /**
           * @name deviceOptionsColorPicker
           * @desc show color picker
           * @type {event}
           */
          deviceOptionsColorPicker.addEventListener('click', function() {
            deviceColorPickerWrap.classList.remove('hidden');
            initColorPicker(deviceColorPicker);
          }, false);
          /**
           * @name deviceColorPickerClose
           * @desc hide color picker
           * @type {event}
           */
          deviceColorPickerClose.addEventListener('click', function() {
            deviceColorPickerWrap.classList.add('hidden');
            while (deviceColorPicker.firstChild) {
              deviceColorPicker.removeChild(deviceColorPicker.firstChild);
            }
          }, false);
          /**
           * @name deviceOptionsBrightness
           * @desc show brightness slider
           * @type {event}
           */
          deviceOptionsBrightness.addEventListener('click', function() {
            deviceBrightness.classList.remove('hidden');
          }, false);
          /**
           * @name deviceBrightnessClose
           * @desc hide brightness slider
           * @type {event}
           */
          deviceBrightnessClose.addEventListener('click', function() {
            deviceBrightness.classList.add('hidden');
          }, false);
          /**
           * @name deviceScheduleBtn
           * @desc open schedule tab
           * @type {Event}
           */
          deviceScheduleBtn.addEventListener('click', function() {
            deviceScheduleTab.classList.remove('hidden');
          }, false);
          /**
           * @name deviceScheduleClose
           * @desc close schedule tab
           * @type {event}
           */
          deviceScheduleClose.addEventListener('click', function(e) {
            deviceScheduleTab.classList.add('hidden');
          });
          /**
           * @name deviceScheduleForm
           * @desc submit form for scheduling device actions
           * @type {event}
           */
          deviceScheduleForm.addEventListener('submit', function() {
            var date = new Date();
            date.setHours(parseInt(hour.value), parseInt(minute.value), 0, 0);

            var job = {
              name: deviceObj.name,
              type: 'device',
              dateTime: {
                dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
                hour: parseInt(hour.value),
                minute: parseInt(minute.value),
                sunrise: false,
                sunset: false
              },
              actions: [{
                emit_name: 'setDevicePowerState',
                params: [deviceObj.id, ctrl.deviceScheduleRepeat]
              }]
            };
            if (ctrl.deviceScheduleRepeat === 'once') {
              job.dateTime = {
                hour: 0,
                minute: 0,
                sunrise: false,
                sunset: false,
                timestamp: Date.parse(date)
              }
            }

            ctrl.setDeviceQuickSchedule(job);
          }, false);
          /**
           * @name hour
           * @desc schedule form hour input, prevent scheduling in the past
           * @type {evemt}
           */
          hour.addEventListener('change', function() {
            if (ctrl.deviceScheduleRepeat === 'once') {
              var date = new Date();
              this.min = date.getHours();
            } else {
              this.min = 0;
            }
          }, false);
          /**
           * @name minute
           * @desc schedule form minute input, prevent scheduling in the past
           * @type {event}
           */
          minute.addEventListener('change', function() {
            if (ctrl.deviceScheduleRepeat === 'once') {
              var date = new Date();
              var h = parseInt(document.getElementById('device-schedule-hours-' + scope.linfo.id).value);
              if (h <= date.getHours()) {
                this.min = date.getMinutes() + 1;
              }
            } else {
              this.min = 0;
            }
          }, false);
          /**
           * @name initColorPicker
           * @desc create color picker
           * @type {function}
           * @param {element} DOM element to create color picker
           */
          function initColorPicker(element) {
            $(element).ColorPickerSliders({
              color: 'hsl(' + ctrl.deviceObj.state.hsl[0] + ',' + ctrl.deviceObj.state.hsl[1] + ',' + ctrl.deviceObj.state.hsl[2] + ')',
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
                ctrl.deviceObj.state.hsl[0] = color.tiny.toHsl().h;
                ctrl.deviceObj.state.hsl[1] = color.tiny.toHsl().s;
                ctrl.deviceObj.state.hsl[2] = color.tiny.toHsl().l;
              }
            });
          }
        }
      };
    }]);
}());
