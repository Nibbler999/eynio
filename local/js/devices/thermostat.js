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
        controllerAs: 'thermostatCtrl',
        controller: ['$scope', function($scope) {

          var thermostatCtrl = this;
          var deviceObj = $scope.tinfo;
          thermostatCtrl.deviceScheduleRepeat = 'daily';
          thermostatCtrl.deviceScheduleTemperature = deviceObj.target;

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
           * @name setThermostatTemperature
           * @desc set target temperature for thermostat
           * @type {function}
           * @param {devId, devTarget} device id, target temperature
           */
          function setThermostatTemperature(devId, devTarget) {
            socket.emit3('setThermostatValue', devId, devTarget, function(response) {
              if (response) {
                thermostatCtrl.setTempSuccess = true;
                $timeout(function() {
                  thermostatCtrl.setTempSuccess = false;
                }, 1500);
              }
            });
          }
          /**
           * @name setThermostatTemperatureDown
           * @desc decrease thermostat target temeperature
           * @type {function}
           * @param {devTarget} target temperature
           */
          function setThermostatTemperatureDown(devTarget) {
            if (devTarget > 18) {
              deviceObj.target -= 1;
            }
          }
          /**
           * @name setThermostatTemperatureUp
           * @desc increase themostat target temop
           * @type {function}
           * @param {devTarget} target temperature
           */
          function setThermostatTemperatureUp(devTarget) {
            if (devTarget < 32) {
              deviceObj.target += 1;
            }
          }
          /**
           * @name setThermostatScheduleTemperatureDown
           * @desc decrease schedule target temperature
           * @type {function}
           * @param {scheduleTarget} schedule target temperature
           */
          function setThermostatScheduleTemperatureDown(scheduleTarget) {
            if (scheduleTarget > 18) {
              thermostatCtrl.deviceScheduleTemperature -= 1;
            }
          }
          /**
           * @name setThermostatScheduleTemperatureUp
           * @desc increase schedule target temperature
           * @type {function}
           * @param {scheduleTarget} schedule target temperature
           */
          function setThermostatScheduleTemperatureUp(scheduleTarget) {
            if (scheduleTarget < 32) {
              thermostatCtrl.deviceScheduleTemperature += 1;
            }
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
                thermostatCtrl.scheduleSuccess = true;
                $timeout(function() {
                  thermostatCtrl.scheduleSuccess = false;
                }, 2500);
              }
            });
          }

          // exports
          thermostatCtrl.toggleDeviceFavorites = toggleDeviceFavorites;
          thermostatCtrl.setThermostatTemperature = setThermostatTemperature;
          thermostatCtrl.setThermostatTemperatureUp = setThermostatTemperatureUp;
          thermostatCtrl.setThermostatTemperatureDown = setThermostatTemperatureDown;
          thermostatCtrl.setThermostatScheduleTemperatureDown = setThermostatScheduleTemperatureDown;
          thermostatCtrl.setThermostatScheduleTemperatureUp = setThermostatScheduleTemperatureUp;
          thermostatCtrl.setDeviceQuickSchedule = setDeviceQuickSchedule;
          thermostatCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = ctrl.deviceObj;
          // device schedule DOM elements
          var deviceScheduleBtn = elem[0].querySelector('#device-schedule-btn');
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
                emit_name: 'setThermostatValue',
                params: [deviceObj.id, ctrl.deviceScheduleTemperature]
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
