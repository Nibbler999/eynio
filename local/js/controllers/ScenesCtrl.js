(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ScenesCtrl', ['$scope', '$state', 'dataService', 'socket', function($scope, $state, dataService, socket) {

      var scene = this;

      scene.scheduleRepeat = 'weekly';
      scene.actionsArr = [];

      var newSceneName = document.getElementById('new-scene-name');

      var newSceneHours = document.getElementById('new-scene-hours');
      var newSceneMinutes = document.getElementById('new-scene-minutes');
      var newSceneDate = document.getElementById('new-scene-date');
      var newSceneDays = document.getElementsByClassName('new-scene-day');
      var newSceneSunrise = document.getElementById('new-scene-sunrise');
      var newSceneSunset = document.getElementById('new-scene-sunset');

      // when checkbox is clicked
      scene.disableInputs = function(e) {
        var disableCheck = e.target.value === 'sunset' ? newSceneSunrise : newSceneSunset;
        if (e.target.checked) {
          disableCheck.disabled = true;
          newSceneHours.disabled = true;
          newSceneMinutes.disabled = true;
          angular.forEach(newSceneDays, function(day) {
            day.disabled = true;
          });
        } else {
          disableCheck.disabled = false;
          newSceneHours.disabled = false;
          newSceneMinutes.disabled = false;
          angular.forEach(newSceneDays, function(day) {
            day.disabled = false;
          });
        }
      };

      // add scene and schedule
      scene.addScene = function(sceneId) {
        var sceneObj;

        sceneObj = {
          name: newSceneName.value,
          actions: scene.actionsArr
        };
        // if ID  edit scene
        if (sceneId) {
          sceneObj.id = sceneId;
          socket.emit('updateScene', sceneObj, function(response) {
            // broadcast to scene to change it actions
            $scope.$broadcast('sceneEdited', response);
            scene.editSceneObj = null;
            if (response && scene.sceneSchedule) {
              addSchedule(sceneId);
            } else {
              scene.restoreData();
            }
          });
        } else {
          socket.emit('addScene', sceneObj, function(response) {
            if (response && scene.sceneSchedule) {
              addSchedule(response);
            } else {
              scene.restoreData();
            }
          });
        }
      };

      function addSchedule(sceneId) {
        var time, scheduleObj, dayOfWeek = [];

        // time = newSceneSunset.checked && !newSceneSunset.disabled ? newSceneSunset.value : newSceneSunrise.checked && !newSceneSunrise.disabled ? newSceneSunrise.value : null;
        if (scene.scheduleRepeat === 'weekly') {
          // time = {};
          // time.dayOfWeek = [];
          angular.forEach(newSceneDays, function(day) {
            if (day.checked && !day.disabled) {
              dayOfWeek.push(parseInt(day.value));
            };
          });
          if (!dayOfWeek.length) {
            dayOfWeek = [0, 1, 2, 3, 4, 5, 6];
          }
          // if (time.dayOfWeek.length === 0) {
          //   time = {};
          // }
          // time.hour = parseInt(newSceneHours.value);
          // time.minute = parseInt(newSceneMinutes.value);
          time = {
            dayOfWeek: dayOfWeek,
            hour: parseInt(newSceneHours.value),
            minute: parseInt(newSceneMinutes.value),
            sunrise: newSceneSunset.checked,
            sunset: newSceneSunrise.checked
          }
        } else if (scene.scheduleRepeat === 'once') {

          var date = new Date();
          date.setTime(Date.parse(newSceneDate.value));
          date.setHours(parseInt(newSceneHours.value), parseInt(newSceneMinutes.value), 0, 0);
          // time = Date.parse(date);
          time = {
            hour: parseInt(newSceneHours.value),
            minute: parseInt(newSceneMinutes.value),
            sunrise: newSceneSunset.checked,
            sunset: newSceneSunrise.checked,
            timestamp: date
          }
        }

        scheduleObj = {
          name: newSceneName.value,
          type: 'scene',
          dateTime: time,
          actions: [{
            emit_name: 'setScene',
            params: [sceneId]
          }]
        };
        console.log(scheduleObj);
        socket.emit('addNewJob', scheduleObj, function(response) {
          if (response) {
            scene.restoreData();
          }
        });
      };

      // check hours to prevent schedule in the past
      scene.checkHours = function(e) {
        if (scene.scheduleRepeat === 'once') {
          var date = new Date();
          e.target.min = date.getHours();
          scene.dateMin = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getUTCDate();
        } else {
          e.target.min = 0;
        }
      };

      // check minutes to prevent schedule in the past
      scene.checkMinutes = function(e) {
        if (scene.scheduleRepeat === 'once') {
          var date = new Date();
          var h = parseInt(document.getElementById('new-scene-hours').value);
          if (h <= date.getHours()) {
            e.target.min = date.getMinutes() + 1;
          }
        } else {
          e.target.min = 0;
        }
      };

      $scope.$on('deviceAction', function(event, device, emitName, param1, param2) {
        console.log(device);
        scene.allDev[device.type].splice(scene.allDev[device.type].indexOf(device), 1);
        scene.actionsArr.push({
          device: device,
          emit_name: emitName,
          params: [device.id, param1, param2]
        });

        console.log(scene.actionsArr);
      });

      scene.deselectDevice = function(dev, index) {
        scene.allDev[dev.type].push(dev);
        scene.actionsArr.splice(index, 1);
      };
      // restore devices, clear inputs
      scene.restoreData = function() {
        angular.forEach(scene.data.getDevicesObj, function(devArray, key) {
          scene.allDev[key] = devArray.slice(0);
        });

        newSceneName.value = '';
        newSceneHours.value = '';
        newSceneMinutes.value = '';
        newSceneDate.value = '';
        newSceneSunrise.checked = false;
        newSceneSunrise.disabled = false;
        newSceneSunset.checked = false;
        newSceneSunset.disabled = false;
        angular.forEach(newSceneDays, function(day) {
          day.checked = false;
          day.disabled = false;
        });
        scene.actionsArr = [];
        $('#display-scenes').collapse('toggle');
        $('#add-new-scene').collapse('toggle');
      };

      // edit scene, get window, filter data
      $scope.$on('editScene', function(event, sceneObj) {
        console.log(sceneObj);

        scene.editSceneObj = sceneObj;
        scene.actionsArr = [];
        angular.forEach(sceneObj.actions, function(action) {
          angular.forEach(scene.allDev[action.device.type], function(dev, index) {
            if (dev.id === action.device.id) {
              scene.allDev[action.device.type].splice(index, 1);
            }
          });
          scene.actionsArr.push(action);
        });
        newSceneName.value = sceneObj.name;
        $('#display-scenes').collapse('toggle');
        $('#add-new-scene').collapse('toggle');
      });

      /* get data */
      scene.data = dataService.getData();
      scene.allDev = {};

      if (scene.data.getDevicesObj) {
        angular.forEach(scene.data.getDevicesObj, function(devArray, key) {
          scene.allDev[key] = devArray.slice(0);
        });
      }
      /* wait on socket to connect than get data */
      if (!scene.data.getDevicesObj || !scene.data.getScenes) {
        dataService.getScenesEmit().then(function(scenes) {
          scene.data.getScenes = scenes;

          dataService.getDevicesEmit().then(function(devices) {
            scene.data.getDevicesObj = devices;
            angular.forEach(scene.data.getDevicesObj, function(devArray, key) {
              scene.allDev[key] = devArray.slice(0);
            });
          })
        })
        dataService.getServerEmits();
        dataService.getCategoriesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
      }
    }]);
}());
