(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ScenesCtrl', ['$scope', '$state', 'socket', 'dataService',
      function($scope, $state, socket, dataService) {

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
        scene.addScene = function() {
          var time, sceneObj, scheduleObj;

          sceneObj = {
            name: newSceneName.value,
            actioins: scene.actionsArr
          };

          socket.emit('addScene', sceneObj, function(response) {
            if (response && scene.sceneSchedule) {
              time = newSceneSunset.checked && !newSceneSunset.disabled ? newSceneSunset.value : newSceneSunrise.checked && !newSceneSunrise.disabled ? newSceneSunrise.value : null;
              if (!time && scene.scheduleRepeat === 'weekly') {
                time = {};
                time.dayOfWeek = [];
                angular.forEach(newSceneDays, function(day) {
                  if (day.checked && !day.disabled) {
                    time.dayOfWeek.push(parseInt(day.value));
                  };
                });
                time.hour = parseInt(newSceneHours.value);
                time.minute = parseInt(newSceneMinutes.value);
              } else if (!time && scene.scheduleRepeat === 'once') {

                var date = new Date();
                date.setTime(Date.parse(newSceneDate.value));
                date.setHours(parseInt(newSceneHours.value), parseInt(newSceneMinutes.value), 0, 0);
                time = Date.parse(date);
              }

              scheduleObj = {
                name: newSceneName.value,
                type: 'scene',
                dateTime: time,
                actions: scene.actionsArr
              };

              socket.emit('addNewJob', scheduleObj, function(response) {
                if (response) {
                  scene.restoreData();
                }
              });
            } else {
              scene.restoreData();
            }
          });
        };

        // select device for scene, remove it from native array
        scene.selectDevice = function(device, index) {
          console.log(device, index);

          if (device.type === 'switch') {
            scene.actionsArr.push({
              device: device,
              'emit_name': 'setDevicePowerState',
              'params': [device.id, device.value]
            });
            scene.allSwitches.splice(index, 1);
          } else if (device.type === 'light') {
            scene.actionsArr.push({
              device: device,
              'emit_name': 'setDevicePowerState',
              'params': [device.id, device.state.on]
            });
            scene.allLights.splice(index, 1);
          }
        };
        // return dev in native array
        scene.deselectDevice = function(dev, index) {
          if (dev.type === 'light') {
            scene.allLights.push(dev);
          } else if (dev.type === 'switch') {
            scene.allSwitches.push(dev);
          }
          scene.actionsArr.splice(index, 1);
        };
        // restore devices, clear inputs
        scene.restoreData = function() {
          angular.forEach(scene.actionsArr, function(actionObj) {
            if (actionObj.device.type === 'switch') {
              scene.allSwitches.push(actionObj.device);
            } else if (actionObj.device.type === 'light') {
              scene.allLights.push(actionObj.device);
            };
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
        };


        $scope.$on('editScene', function(event, sceneForEdit) {
          /* set new data */
          scene.sceneForEdit = sceneForEdit;
          console.log(sceneForEdit);
          newScene.style.marginTop = '0%';
          newSceneName.value = sceneForEdit.name;
          scene.actionsArr = [];
          angular.forEach(sceneForEdit.actions, function(action) {
            scene.actionsArr.push(action);
            console.log(action);
            if (action.device.type === 'light') {
              angular.forEach(scene.allLights, function(light) {
                if (action.device.id === light.id) {
                  scene.allLights.splice(scene.allLights.indexOf(light), 1);
                }
              });
            } else if (action.device.type === 'switch') {
              angular.forEach(scene.allSwitches, function(swch) {
                if (action.device.id === swch.id) {
                  scene.allSwitches.splice(scene.allSwitches.indexOf(swch), 1);
                }
              });
            }
          });
          console.log(scene.allLights);
          console.log(scene.actionsArr);
        });

        /* get data */
        var allDev = dataService.allDev();
        var allRemotes = dataService.allCustomRemotes();
        scene.allScenes = dataService.scenes();

        scene.allLights = dataService.sortDevicesByType(allDev, 'light');
        scene.allSwitches = dataService.sortDevicesByType(allDev, 'switch');
        scene.allTvRemotes = dataService.sortRemotesByType(allRemotes, 'tv');
        /* wait on socket to connect than get data */
        if (!allDev || !scene.allScenes) {
          dataService.dataPending().then(function() {

            allDev = dataService.allDev();
            allRemotes = dataService.allCustomRemotes();
            scene.allScenes = dataService.scenes();

            scene.allLights = dataService.sortDevicesByType(allDev, 'light');
            scene.allSwitches = dataService.sortDevicesByType(allDev, 'switch');

            scene.allTvRemotes = dataService.sortRemotesByType(allRemotes, 'tv');
          });
        }
      }
    ]);
}());
