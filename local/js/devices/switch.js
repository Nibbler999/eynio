(function() {
  "use strict";

  angular
    .module('services')
    .directive('switch', ['$timeout', '$state', 'dataService', 'socket', function($timeout, $state, dataService, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/switch.html',
        scope: {
          sinfo: '='
        },
        controllerAs: 'switchCtrl',
        controller: ['$scope', function($scope) {

          var switchCtrl = this;
          var deviceObj = $scope.sinfo;

          switchCtrl.scheduleState = deviceObj.value || false;
          switchCtrl.deviceScheduleRepeat = 'daily';

          // listen for state change
          socket.on('switchState', function(newState) {
            if (deviceObj.id === newState.id) {
              deviceObj.value = newState.state.on;
            };
            setDeviceIcon();
          });
          /**
           * @name setDeviceIcon
           * @desc set device icon depending on state
           * @type {function}
           * @param {}
           */
          function setDeviceIcon() {
            if (deviceObj.value) {
              switchCtrl.deviceIcon = 'img/device/switch-on.png';
            } else {
              switchCtrl.deviceIcon = 'img/device/switch-off.png';
            }
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
           * @name toggleDevicePowerState
           * @desc switch between power states
           * @type {function}
           * @param {devId} device id
           */
          function toggleDevicePowerState(devId) {
            socket.emit('toggleDevicePowerState', devId);
          }
          /**
           * @name setSwitchPowerStateOn
           * @desc set switch state to ON
           * @type {function}
           * @param {devId} device id
           */
          function setSwitchPowerStateOn(devId) {
            socket.emit('switchOn', devId);
          }
          /**
           * @name setSwitchPowerStateOff
           * @desc set switch state OFF
           * @type {function}
           * @param {devId} device id
           */
          function setSwitchPowerStateOff(devId) {
            socket.emit('switchOff', devId);
          }
          /**
           * @name setDeviceQuickSchedule
           * @desc schedule action
           * @type {function}
           * @param {scheduleObj} generated schedule obj from link function
           */
          function setDeviceQuickSchedule(scheduleObj) {
            socket.emit('addNewJob', scheduleObj, function(response) {
              if (response) {
                switchCtrl.scheduleSuccess = true;
                $timeout(function() {
                  switchCtrl.scheduleSuccess = false;
                }, 2500);
              }
            });
          }
          setDeviceIcon();
          // exports
          switchCtrl.toggleDeviceFavorites = toggleDeviceFavorites;
          switchCtrl.toggleDevicePowerState = toggleDevicePowerState;
          switchCtrl.setSwitchPowerStateOn = setSwitchPowerStateOn;
          switchCtrl.setSwitchPowerStateOff = setSwitchPowerStateOff;
          switchCtrl.setDeviceQuickSchedule = setDeviceQuickSchedule;
          switchCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = ctrl.deviceObj;
          // device schedule DOM elements
          var deviceScheduleBtn = elem[0].querySelector('.device-schedule-btn');
          var deviceScheduleTab = elem[0].querySelector('#device-schedule-tab');
          var deviceScheduleClose = deviceScheduleTab.querySelector('.close-device-options');
          var deviceScheduleForm = deviceScheduleTab.querySelector('form');
          var hour = deviceScheduleForm.querySelectorAll('input[type="number"]')[0];
          var minute = deviceScheduleForm.querySelectorAll('input[type="number"]')[1];

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
                params: [deviceObj.id, ctrl.scheduleState]
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
          hour.addEventListener('click', function() {
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
          minute.addEventListener('click', function() {
            if (ctrl.deviceScheduleRepeat === 'once') {
              var date = new Date();
              var h = parseInt(hour.value);
              if (h <= date.getHours()) {
                this.min = date.getMinutes() + 1;
              }
            } else {
              this.min = 0;
            }
          }, false);
        }
      };
    }]);
}());
