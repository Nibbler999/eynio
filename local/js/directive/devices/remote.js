(function() {
  "use strict";

  angular
    .module('services')
    .directive('remote', ['$timeout','$state',  'dataService', 'socket',
      function($timeout, $state, dataService, socket) {
        return {
          restrict: 'E',
          replace: true,
          templateUrl: 'html/directive/devices/remote.html',
          scope: {
            tvinfo: '='
          },
          controllerAs: 'remoteCtrl',
          controller: ['$scope', function($scope) {

            var remoteCtrl = this;
            var deviceObj = $scope.tvinfo;
            var quickKeysRadioValue = 'ch';
            var deviceScheduleRepeat = 'daily';
            /**
             * @name remoteKeyAction
             * @desc emit key to tv
             * @type {function}
             * @param {remId, key} remote id, specific key
             */
            function remoteKeyAction(remId, key) {
              if (remoteCtrl.remoteLearningMode) {
                remoteCtrl.remoteLearnKey = key;
                socket.emit('learnKey', remId, key);
              } else {
                socket.emit('sendKey', remId, key);
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
             * @name setDeviceQuickSchedule
             * @desc schedule action
             * @type {function}
             * @param {scheduleObj} generated schedule obj from link function
             */
            function setDeviceQuickSchedule(scheduleObj) {
              socket.emit('addNewJob', scheduleObj, function(response) {
                if (response) {
                  remoteCtrl.scheduleSuccess = true;
                  $timeout(function() {
                    remoteCtrl.scheduleSuccess = false;
                  }, 2500);
                }
              });
            }
            // exports
            remoteCtrl.setDeviceQuickSchedule = setDeviceQuickSchedule;
            remoteCtrl.remoteKeyAction = remoteKeyAction;
            remoteCtrl.deviceScheduleRepeat = deviceScheduleRepeat;
            remoteCtrl.quickKeysRadioValue = quickKeysRadioValue;
            remoteCtrl.toggleDeviceFavorites = toggleDeviceFavorites;
            remoteCtrl.deviceObj = deviceObj;
          }],
          link: function(scope, elem, attr, ctrl) {

            var deviceObj = ctrl.deviceObj;
            // remote DOM
            var remoteWrap = elem[0];
            var getFullRemoteBtn = elem[0].querySelector('.device-icon');
            var fullRemote = elem[0].querySelector('#remote-full');
            var fullRemoteClose = elem[0].querySelector('.close-device-options');
            var notNumpad = elem[0].querySelector('#remote-not-numpad');
            var numpadBtn = elem[0].querySelector('#numpad-btn');
            var numpad = elem[0].querySelector('#remote-numpad');
            var quickRemoteButtons = elem[0].querySelectorAll('[name=remote-quick-btn]');
            var allRemoteButtons = elem[0].querySelectorAll('[name=remote-btn]');
            var learningModeCheckbox = elem[0].querySelectorAll('input[type="checkbox"]')[1];
            var chRadio = elem[0].querySelectorAll('input[type="radio"]')[0];
            var volRadio = elem[0].querySelectorAll('input[type="radio"]')[1];
            var chUpBtn = elem[0].querySelector('[data-remote-key=CHUP]');
            var chDownBtn = elem[0].querySelector('[data-remote-key=CHDOWN]');
            var volUpBtn = elem[0].querySelector('[data-remote-key=VOLUP]');
            var volDownBtn = elem[0].querySelector('[data-remote-key=VOLDOWN]');
            // device schedule DOM elements
            var deviceScheduleBtn = elem[0].querySelector('.device-schedule-btn');
            var deviceScheduleTab = elem[0].querySelector('#device-schedule-tab');
            var deviceScheduleClose = deviceScheduleTab.querySelector('.close-form-btn');
            var deviceScheduleForm = deviceScheduleTab.querySelector('form');
            var hour = deviceScheduleForm.querySelectorAll('input[type="number"]')[0];
            var minute = deviceScheduleForm.querySelectorAll('input[type="number"]')[1];
            // all remote keys
            var keys = ["POWER", "SOURCE", "UP", "DOWN", "LEFT", "RIGHT", "OK", "MENU", "MUTE", "RETURN", "VOLUP", "VOLDOWN", "CHUP", "CHDOWN", "NUM_0", "NUM_1", "NUM_2", "NUM_3", "NUM_4", "NUM_5", "NUM_6", "NUM_7", "NUM_8", "NUM_9"];
            // quick action keys
            var quickKeys = ['POWER', 'CHUP', 'CHDOWN', 'VOLUP', 'VOLDOWN'];
            // add listeners on all remote buttons, and inactive class if not learned
            angular.forEach(allRemoteButtons, function(btn) {
              if (deviceObj.keys.indexOf(btn.dataset.remoteKey) === -1) {
                btn.classList.add('remote-btn-inactive');
              }
              /**
               * @name btn
               * @desc on click send key
               * @type {event}
               */
              btn.addEventListener('click', function() {
                ctrl.remoteKeyAction(deviceObj.id, this.dataset.remoteKey);
                scope.$apply();
              }, false)
            });
            // add listeners on all quick keys and inactive class if not learned
            angular.forEach(quickRemoteButtons, function(btn) {
              if (deviceObj.keys.indexOf(btn.dataset.remoteKey) === -1) {
                btn.classList.add('remote-btn-inactive');
              }
              /**
               * @name quick btn
               * @desc on click send key
               * @type {event}
               */
              btn.addEventListener('click', function() {
                ctrl.remoteKeyAction(deviceObj.id, this.dataset.remoteKey);
                scope.$apply();
              }, false)
            });
            // listen for new learned btns
            socket.on('IRKeyLearned', function(response) {
              if (response.remoteid === deviceObj.id) {
                window.navigator.vibrate(200);
                deviceObj.keys.push(response.key);
                angular.forEach(allRemoteButtons, function(btn) {
                    if (btn.dataset.remoteKey === response.key) {
                      btn.classList.remove('remote-btn-inactive');
                    }
                  })
                  // check for quickKeys
                if (quickKeys.indexOf(response.key) !== -1) {
                  angular.forEach(quickRemoteButtons, function(btn) {
                    if (btn.dataset.remoteKey === response.key) {
                      btn.classList.remove('remote-btn-inactive');
                    }
                  })
                }
                ctrl.remoteLearnKey = null;
              }
            });
            /**
             * @name chRadio
             * @desc on radio change, hide volume btns
             * @type {event}
             */
            chRadio.addEventListener('change', function() {
              chUpBtn.classList.remove('hidden');
              chDownBtn.classList.remove('hidden');
              volUpBtn.classList.add('hidden');
              volDownBtn.classList.add('hidden');
            }, false);
            /**
             * @name volRadio
             * @desc on radio change, hide channel btn
             * @type {envet}
             */
            volRadio.addEventListener('change', function() {
              chUpBtn.classList.add('hidden');
              chDownBtn.classList.add('hidden');
              volUpBtn.classList.remove('hidden');
              volDownBtn.classList.remove('hidden');
            }, false);
            /**
             * @name getFullRemoteBtn
             * @desc expand remote
             * @type {event}
             */
            getFullRemoteBtn.addEventListener('click', function() {
              remoteWrap.classList.add('full-remote');
              fullRemote.classList.remove('hidden');
            }, false);
            /**
             * @name fullRemoteClose
             * @desc collapse full remote, turn off learning mode
             * @type {event}
             */
            fullRemoteClose.addEventListener('click', function() {
              fullRemote.classList.add('hidden');
              if (ctrl.remoteLearningMode) {
                ctrl.remoteLearningMode = false;
                scope.$apply();
                return
              }
              remoteWrap.classList.remove('full-remote');
            }, false);
            /**
             * @name numpadBtn
             * @desc on click toggle hidden class on numpad btns and regular btns
             * @type {function}
             */
            numpadBtn.addEventListener('click', function() {
              notNumpad.classList.toggle('hidden');
              numpad.classList.toggle('hidden');
            }, false);
            /**
             * @name
             * @desc
             * @type {type}
             * @param {param}
             */
            learningModeCheckbox.addEventListener('change', function() {
              fullRemote.classList.remove('hidden');
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
                  emit_name: 'sendKey',
                  params: [deviceObj.id, 'POWER']
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
      }
    ]);
}());
