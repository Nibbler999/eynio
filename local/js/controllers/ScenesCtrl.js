(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ScenesCtrl', ['$scope', '$state', 'socket', 'dataService',
      function($scope, $state, socket, dataService) {

        var scene = this;

        var daysArr = [];
        var itemsArr = [];
        scene.actionsArr = [];
        var sceneScheduleTime;

        var newScene = document.querySelector('.new-scene');
        var newSceneName = document.getElementById('new-scene-name');
        var newSceneHours = document.getElementById('new-scene-hours');
        var newSceneMinutes = document.getElementById('new-scene-minutes');
        var newSceneDays = document.querySelectorAll('.new-scene-day');
        var newSceneSunset = document.getElementById('new-scene-sunset');
        var newSceneSunrise = document.getElementById('new-scene-sunrise');

        /* get add screen menu */
        document.querySelector('.add-new-btn').onclick = function() {
          newScene.style.marginTop = '0%';
        };
        /* scene schedule days */
        angular.forEach(newSceneDays, function(day) {
          day.onclick = function() {
            getDays();
          }
        });

        /* new scene added */
        socket.on('sceneAdded', function(sceneAdded) {
          console.log(sceneAdded);
          scene.allScenes.push(sceneAdded);
        });

        function getDays() {
          daysArr = [];
          angular.forEach(newSceneDays, function(day) {
            if (day.checked) {
              daysArr.push(parseInt(day.value));
            }
          });
        };

        /* save schedule for scene */
        function saveSchedule() {
          if (newSceneSunset.checked) {
            sceneScheduleTime = newSceneSunset.value;
          } else if (newSceneSunrise.checked) {
            sceneScheduleTime = newSceneSunrise.value;
          } else if (newSceneHours.value > 23) {
            newSceneHours.value = 23;
            alert('Hours above 23 are not allowed!');
          } else if (newSceneMinutes.value > 59) {
            newSceneMinutes.value = 59;
            alert('Minutes above 59 are not allowed!');
          } else if (!newSceneHours.value || !newSceneMinutes.value) {
            return
          } else {
            sceneScheduleTime = {
              'hour': parseInt(newSceneHours.value),
              'minute': parseInt(newSceneMinutes.value),
              'dayOfWeek': daysArr
            };
          }
          console.log(sceneScheduleTime);
        };

        scene.getSunsetSunrise = function(sunTime) {
          if (sunTime === 'sunrise') {
            if (newSceneSunrise.checked) {

              angular.forEach(newSceneDays, function(days) {
                days.disabled = true;
                days.checked = false;
              });
              newSceneSunset.disabled = true;
              newSceneHours.disabled = true;
              newSceneHours.value = '';
              newSceneMinutes.disabled = true;
              newSceneMinutes.value = '';
              daysArr = [];
            } else {
              angular.forEach(newSceneDays, function(days) {
                days.disabled = false;
              });

              newSceneSunset.disabled = false;
              newSceneHours.disabled = false;
              newSceneMinutes.disabled = false;
            }
          } else if (sunTime === 'sunset') {
            if (newSceneSunset.checked) {

              angular.forEach(newSceneDays, function(days) {
                days.disabled = true;
                days.checked = false;
              });
              newSceneSunrise.disabled = true;
              newSceneHours.disabled = true;
              newSceneHours.value = '';
              newSceneMinutes.disabled = true;
              newSceneMinutes.value = '';
              daysArr = [];
            } else {
              angular.forEach(newSceneDays, function(days) {
                days.disabled = false;
              });

              newSceneSunrise.disabled = false;
              newSceneHours.disabled = false;
              newSceneMinutes.disabled = false;
            }
          }
        };

        /* cancel Schedule */
        scene.cancelSchedule = function() {

          newScene.style.marginTop = '100%';
          /* clear data */
          angular.forEach(allDev, function(dev) {
            dev.schedule_select = false;
          });
          angular.forEach(newSceneDays, function(days) {
            days.disabled = false;
          });
          newSceneSunrise.disabled = false;
          newSceneSunset.disabled = false;
          newSceneHours.disabled = false;
          newSceneMinutes.disabled = false;


          /* clear input data */
          newSceneName.value = '';
          angular.forEach(scene.actionsArr, function(dev) {
            if (dev.device.type === 'switch') {
              scene.allSwitches.push(dev.device);
            } else if (dev.device.type === 'light') {
              scene.allLights.push(dev.device);
            }
          });
          scene.actionsArr = [];
          sceneScheduleTime = null;
        };

        scene.selectedForScene = function(device, index) {
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
          console.log(scene.actionsArr);
        };

        scene.deselectDevice = function(deselectDev, index) {
          if (deselectDev.device.type === 'switch') {
            console.log(scene.allSwitches);
            scene.allSwitches.push(deselectDev.device);

            console.log(scene.allSwitches);
          } else if (deselectDev.device.type === 'light') {
            scene.allLights.push(deselectDev.device);
          }
          scene.actionsArr.splice(index, 1);
        };

        scene.addScene = function() {
          if (!scene.actionsArr.length) {
            return
          } else {
            if (scene.sceneSchedule) {
              saveSchedule();
            }
            var sceneObj = {
              name: newSceneName.value,
              actions: scene.actionsArr
            };
            if (scene.sceneForEdit) {
              sceneObj.id = scene.sceneForEdit.id;
              socket.emit('updateScene', sceneObj, function(sceneEdited) {
                if (sceneEdited) {
                  angular.forEach(scene.allScenes, function(sce){
                    if(sce.id === sceneEdited.id){
                      scene.allScenes.splice(scene.allScenes.indexOf(sce), 1);
                      scene.allScenes.push(sceneEdited);
                    }
                  });
                }
              });
            } else {
              socket.emit('addScene', sceneObj, function(addedScene) {
                console.log(addedScene);
              });
            }
            if (sceneScheduleTime) {
              socket.emit4('addNewJob', newSceneName.value, sceneScheduleTime, scene.actionsArr, function(data) {
                console.log(data);
              });
            }
            /* clear input data */
            newSceneName.value = '';
            angular.forEach(scene.actionsArr, function(dev) {
              if (dev.device.type === 'switch') {
                scene.allSwitches.push(dev.device);
              } else if (dev.device.type === 'light') {
                scene.allLights.push(dev.device);
              }
            });
            scene.actionsArr = [];
            sceneScheduleTime = null;
          }
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

        /* get devices from server */
        var allDev = dataService.allDev();
        console.log(allDev);
        if (!allDev) {
          dataService.dataPending().then(function() {
            allDev = dataService.allDev();

            scene.allScenes = dataService.scenes();
            scene.allSwitches = dataService.switches();
            scene.allLights = dataService.lights();
            scene.allTvRemotes = dataService.TVcustomRemotes();
            console.log(scene.allLights);
          });
        } else {
          scene.allScenes = dataService.scenes();
          scene.allSwitches = dataService.switches();
          scene.allLights = dataService.lights();
          scene.allTvRemotes = dataService.TVcustomRemotes();
        }

      }
    ]);
}());
