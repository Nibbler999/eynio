(function() {
  "use strict";

  angular
    .module('services')
    .directive('addScene', ['$q', 'socket', 'dataService', function($q, socket, dataService) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/addScene.html',
        controllerAs: 'addSceneCtrl',
        controller: ['$scope', function($scope) {

          var addSceneCtrl = this;
          var allDeviceObj = dataService.getData().getDevicesObj;

          // if no devices, request from server
          if (!allDeviceObj) {
            allDeviceObj = {};
            dataService.getDevicesEmit().then(function(devices) {
              angular.forEach(devices, function(devArray, key) {
                allDeviceObj[key] = devArray.slice(0);
              });
            })
          }
          /**
           * @name addNewScene
           * @desc add new scene, if Id edit scene
           * @type {function}
           * @param {newSceObj} new scene object
           */
          function addNewScene(newSceObj) {
            var defer = $q.defer();
            socket.emit('addScene', newSceObj, function(response) {
              defer.resolve(response);
            });
            return defer.promise
          }
          /**
           * @name updateScene
           * @desc update scene
           * @type {function}
           * @param {sceObj} scene object
           */
          function updateScene(sceObj) {
            var defer = $q.defer();
            socket.emit('updateScene', sceObj, function(response) {
              defer.resolve(response);
            });
            return defer.promise
          }
          /**
           * @name addSchedule
           * @desc add schedule to scene
           * @type {function}
           * @param {scheObj} schedule object
           */
          function addSchedule(scheObj) {
            socket.emit('addNewJob', scheObj)
          }
          /**
           * @name addDeviceToScene
           * @desc add device to scenes actions arr
           * @type {function}
           * @param {devObj, emitName, param1, param2} device object, emit name, value/state/color
           */
          function addDeviceToScene(devObj, emitName, param1, param2) {
            allDeviceObj[devObj.type].splice(allDeviceObj[devObj.type].indexOf(devObj), 1);
            addSceneCtrl.actionsArr.push({
              device: devObj,
              emit_name: emitName,
              params: [devObj.id, param1, param2]
            });
          }
          /**
           * @name removeDeviceFromScene
           * @desc remove device from scenes actions arr
           * @type {function}
           * @param {actionObj, index} action object, index
           */
          function removeDeviceFromScene(actionObj, index) {
            addSceneCtrl.actionsArr.splice(index, 1);
            allDeviceObj[actionObj.device.type].push(actionObj.device);
          }
          /**
           * @name restoreDevices
           * @desc restore data, return them to object
           * @type {function}
           */
          function restoreDevices() {
            angular.forEach(addSceneCtrl.actionsArr, function(action) {
              allDeviceObj[action.device.type].push(action.device);
            });
            addSceneCtrl.actionsArr = [];
          }

          // exports
          addSceneCtrl.allDeviceObj = allDeviceObj;
          addSceneCtrl.addNewScene = addNewScene;
          addSceneCtrl.updateScene = updateScene;
          addSceneCtrl.addSchedule = addSchedule;
          addSceneCtrl.addDeviceToScene = addDeviceToScene;
          addSceneCtrl.removeDeviceFromScene = removeDeviceFromScene;
          addSceneCtrl.restoreDevices = restoreDevices;

          addSceneCtrl.sceneScheduleRepeat = 'once';
          addSceneCtrl.actionsArr = [];
        }],
        link: function(scope, elem, attr, ctrl) {

          // add scene DOM
          var wrap = elem[0];
          var cancelBtn = elem[0].querySelector('.orange-btn');
          var form = elem[0].querySelector('form');
          var name = form.querySelector('#new-scene-name');
          var hour = form.querySelector('#new-scene-hours');
          var minute = form.querySelector('#new-scene-minutes');
          var date = form.querySelector('#new-scene-date');
          var days = form.querySelectorAll('.new-scene-day');
          var sunrise = form.querySelector('#new-scene-sunrise');
          var sunset = form.querySelector('#new-scene-sunset');
          // display scenes row, not part of directive
          var displayScenes = document.getElementById('display-scenes');
          var editSceneObj;

          /**
           * @name setMinInputs
           * @desc block schedules in past
           * @type {function}
           */
          function setMinInputs() {
            var dateTime = new Date();
            var year = dateTime.getFullYear();
            var month = dateTime.getMonth();
            var day = dateTime.getDate();
            month++;
            if (month < 10) {
              month = '0' + month;
            }
            date.min = year + '-' + month + '-' + day;
          }
          /**
           * @name cancelBtn
           * @desc hide form, erase data
           * @type {event}
           */
          cancelBtn.addEventListener('click', function() {
            editSceneObj = null;
            ctrl.restoreDevices();
            form.reset();
            $(displayScenes).collapse('toggle');
            $(wrap).collapse('toggle');
            scope.$apply();
          }, false);
          /**
           * @name sunrise
           * @desc disable time inputs
           * @type {event}
           */
          sunrise.addEventListener('click', disableFormInputs, false);
          /**
           * @name sunset
           * @desc diasble time inputs
           * @type {event}
           */
          sunset.addEventListener('click', disableFormInputs, false);
          /**
           * @name disableFormInputs
           * @desc disableing other inputs when "sunrise" or "sunset" checked
           * @type {function}
           */
          function disableFormInputs() {
            var disableCheck = this.value === 'sunset' ? sunrise : sunset;
            if (this.checked) {
              disableCheck.disabled = true;
              hour.disabled = true;
              minute.disabled = true;
            } else {
              disableCheck.disabled = false;
              hour.disabled = false;
              minute.disabled = false;
            }
            scope.$apply();
          }
          /**
           * @name sceneSchedule
           * @desc prepare schedule object
           * @type {function}
           * @param {sceObj} scene object
           */
          function sceneSchedule(sceObj) {
            console.log(sceObj);
            var time = {
              hour: 0,
              minute: 0,
              sunrise: false,
              sunset: false
            };
            if (ctrl.sceneScheduleRepeat === 'daily') {
              time.dayOfWeek = [];
              time.sunrise = !sunrise.disabled && sunrise.checked ? true : false;
              time.sunset = !sunset.disabled && sunset.checked ? true : false;
              time.hour = !hour.disabled ? parseInt(hour.value) : null;
              time.minute = !minute.disabled ? parseInt(minute.value) : null;
              angular.forEach(days, function(day) {
                if (day.checked && !day.disabled) {
                  time.dayOfWeek.push(parseInt(day.value));
                };
              });
            } else {
              var newDate = new Date();
              newDate.setTime(Date.parse(date.value));
              newDate.setHours(parseInt(hour.value), parseInt(minute.value), 0, 0);
              time.timestamp = newDate.getTime();
            }
            var job = {
              name: sceObj.name,
              type: 'scene',
              dateTime: time,
              actions: [{
                emit_name: 'setScene',
                params: [sceObj.id]
              }]
            }
            ctrl.addSchedule(job);
          }
          /**
           * @name form
           * @desc submit form, create/edit scene
           * @type {event}
           */
          form.addEventListener('submit', function() {
            var newSceneObj = editSceneObj || {};
            newSceneObj.name = name.value;
            newSceneObj.actions = ctrl.actionsArr;

            console.log(newSceneObj);
            if (newSceneObj.id) {
              ctrl.updateScene(newSceneObj).then(function(response) {
                console.log(response);
                if (response) {
                  // broadcast to scene to change it actions
                  scope.$broadcast('sceneEdited', response);
                  editSceneObj = null;
                  if (ctrl.sceneSchedule) {
                    sceneSchedule(response);
                  }
                  form.reset();
                  ctrl.restoreDevices();
                  $(displayScenes).collapse('toggle');
                  $(wrap).collapse('toggle');
                }
              });
            } else {
              ctrl.addNewScene(newSceneObj).then(function(response) {
                if (response) {
                  if (ctrl.sceneSchedule) {
                    newSceneObj.id = response;
                    sceneSchedule(newSceneObj);
                  }
                  form.reset();
                  ctrl.restoreDevices();
                  $(displayScenes).collapse('toggle');
                  $(wrap).collapse('toggle');
                }
              });
            }
          }, false);

          // init
          setMinInputs();
          // listen for device that needs editing
          scope.$on('editScene', function(event, sceObj) {
            console.log(sceObj);
            editSceneObj = sceObj;
            ctrl.actionsArr = [];
            name.value = editSceneObj.name;
            angular.forEach(editSceneObj.actions, function(action) {
              // fill actions array
              ctrl.actionsArr.push(action);
              // remove device from object
              ctrl.allDeviceObj[action.device.type].splice(ctrl.allDeviceObj[action.device.type]
                .indexOf(action.device), 1);
            });
            $(displayScenes).collapse('toggle');
            $(wrap).collapse('toggle');
          });
        }
      }
    }])
}());
