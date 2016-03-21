(function() {
  "use strict";

  angular
    .module('services')
    .directive('scene', ['$state', '$timeout', 'socket', function($state, $timeout, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/scene.html',
        scope: {
          scinfo: '='
        },
        controllerAs: 'sceneCtrl',
        controller: ['$scope', function($scope) {

          var sceneCtrl = this;
          var deviceObj = $scope.scinfo;

          sceneCtrl.deviceScheduleRepeat = 'daily';

          // listen for custom eventst and update scene object
          $scope.$on('sceneEdited', function(event, response) {
            if (deviceObj.id === response.id) {
              deviceObj = response;
            }
          });
          /**
           * @name setScene
           * @desc set scene in action
           * @type {function}
           * @param {sceneId} scene id
           */
          function setScene(sceneId) {
            socket.emit('setScene', sceneId)
          }
          /**
           * @name deleteScene
           * @desc delete scene
           * @type {function}
           * @param {sceneId} scene id
           */
          function deleteScene(sceneId) {
            socket.emit('deleteScene', sceneId)
          }
          /**
           * @name editScene
           * @desc edit scene
           * @type {function}
           * @param {sceObj} scene object
           */
          function editScene(sceObj) {
            $scope.$emit('editScene', sceObj);
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
                sceneCtrl.scheduleSuccess = true;
                $timeout(function() {
                  sceneCtrl.scheduleSuccess = false;
                }, 2500);
              }
            });
          }

          // exports
          sceneCtrl.setDeviceQuickSchedule = setDeviceQuickSchedule;
          sceneCtrl.setScene = setScene;
          sceneCtrl.deleteScene = deleteScene;
          sceneCtrl.editScene = editScene;
          sceneCtrl.deviceObj = deviceObj;
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
          // scene footer document
          var footer = elem[0].querySelector('.sce-box-footer');
          // current state
          var currentState = $state.current.name;
          // remove footer if in dashboard
          if (currentState === 'frame.dashboard') {
            footer.classList.add('hidden')
          } else {
            footer.classList.remove('hidden')
          }
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
              type: 'scene',
              dateTime: {
                dayOfWeek: [0, 1, 2, 3, 4, 5, 6],
                hour: parseInt(hour.value),
                minute: parseInt(minute.value),
                sunrise: false,
                sunset: false
              },
              actions: [{
                emit_name: 'setScene',
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
      };
    }]);
}());
