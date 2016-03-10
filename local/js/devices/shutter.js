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
        controllerAs: 'shutterCtrl',
        controller: ['$scope', function($scope) {

          var shutterCtrl = this;
          var deviceObj = $scope.shinfo;

          shutterCtrl.scheduleState = deviceObj.value < 50 ? true : false;
          shutterCtrl.deviceScheduleRepeat = 'daily';
          // listen for changes and change icon corespondigly
          socket.on('shutterValue', function(response) {
            if (response.id === deviceObj.id) {
              deviceObj.value = response.value;
              setDeviceIcon();
            }
          });
          /**
           * @name setDeviceIcon
           * @desc set proper device icon, open/close
           * @type {function}
           */
          function setDeviceIcon() {
            if (deviceObj.value < 50) {
              shutterCtrl.deviceIcon = 'img/device/shutter-on.png';
              return
            }
            shutterCtrl.deviceIcon = 'img/device/shutter-off.png';
          }
          /**
           * @name toggleShutterState
           * @desc toggle shutter
           * @type {function}
           * @param {devId} device id
           */
          function toggleShutterState(devId) {
            socket.emit('toggleShutter', devId, function(response) {
              console.log(response);
            })
          }
          /**
           * @name setShutterStateOpen
           * @desc open shutters
           * @type {function}
           * @param {devId} device id
           */
          function setShutterStateOpen(devId) {
            socket.emit('openShutter', devId, function(response) {
              if (response) {
                shutterCtrl.openShutterSuccess = true;
                $timeout(function() {
                  shutterCtrl.openShutterSuccess = false;
                }, 750)
              }
            })
          }
          /**
           * @name setShutterStateClose
           * @desc close shutters
           * @type {function}
           * @param {devId} device id
           */
          function setShutterStateClose(devId) {
            socket.emit('closeShutter', devId, function(response) {
              if (response) {
                shutterCtrl.closeShutterSuccess = true;
                $timeout(function() {
                  shutterCtrl.closeShutterSuccess = false;
                }, 750)
              }
            })
          }
          /**
           * @name setShutterStateStop
           * @desc stop shutters while opening/closing
           * @type {function}
           * @param {devId} device id
           */
          function setShutterStateStop(devId) {
            socket.emit('stopShutter', devId, function(response) {
              if (response) {
                shutterCtrl.stopShutterSuccess = true;
                deviceObj.value = parseInt(response.value);
                setDeviceIcon();
                $timeout(function() {
                  shutterCtrl.stopShutterSuccess = true;
                }, 750);
              }
            })
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
           * @name setDeviceQuickSchedule
           * @desc schedule action
           * @type {function}
           * @param {scheduleObj} generated schedule obj from link function
           */
          function setDeviceQuickSchedule(scheduleObj) {
            socket.emit('addNewJob', scheduleObj, function(response) {
              if (response) {
                shutterCtrl.scheduleSuccess = true;
                $timeout(function() {
                  shutterCtrl.scheduleState = false;
                }, 2500);
              }
            });
          }
          setDeviceIcon();

          //  exports
          shutterCtrl.toggleDeviceFavorites = toggleDeviceFavorites;
          shutterCtrl.toggleShutterState = toggleShutterState;
          shutterCtrl.setShutterStateStop = setShutterStateStop;
          shutterCtrl.setShutterStateOpen = setShutterStateOpen;
          shutterCtrl.setShutterStateClose = setShutterStateClose;
          shutterCtrl.setDeviceQuickSchedule = setDeviceQuickSchedule;
          shutterCtrl.deviceObj = deviceObj;
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
                emit_name: ctrl.scheduleState ? 'openShutter' : 'closeShutter',
                params: [deviceObj.id]
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
      }
    }]);
}());
