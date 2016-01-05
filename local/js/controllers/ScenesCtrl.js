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
        scene.addScene = function(sceneId) {
          var sceneObj;

          sceneObj = {
            name: newSceneName.value,
            actions: scene.actionsArr
          };

          if (sceneId) {
            sceneObj.id = sceneId;
            socket.emit('updateScene', sceneObj, function(response) {
              console.log(response);
              $scope.$broadcast('sceneEdited', response);
              // angular.forEach(scene.allScenes, function(scene) {
              //   if (scene.id === response.id) {
              //     scene = response;
              //   }
              // });
              scene.editSceneObj = null;
              if (response && scene.sceneSchedule) {
                addSchedule();
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
          var time, scheduleObj;

          time = newSceneSunset.checked && !newSceneSunset.disabled ? newSceneSunset.value : newSceneSunrise.checked && !newSceneSunrise.disabled ? newSceneSunrise.value : null;
          if (!time && scene.scheduleRepeat === 'weekly') {
            time = {};
            time.dayOfWeek = [];
            angular.forEach(newSceneDays, function(day) {
              if (day.checked && !day.disabled) {
                time.dayOfWeek.push(parseInt(day.value));
              };
            });
            if (time.dayOfWeek.length === 0) {
              time = {};
            }
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

        // // select device for scene, remove it from native array
        // scene.selectDevice = function(device, index) {
        //   console.log(device, index);
        //
        //   if (device.type === 'switch') {
        //     scene.actionsArr.push({
        //       device: device,
        //       'emit_name': 'setDevicePowerState',
        //       'params': [device.id, device.value]
        //     });
        //     scene.allSwitches.splice(index, 1);
        //   } else if (device.type === 'light') {
        //     scene.actionsArr.push({
        //       device: device,
        //       'emit_name': 'setDevicePowerState',
        //       'params': [device.id, device.state.on]
        //     });
        //     scene.allLights.splice(index, 1);
        //   }
        // };
        // return dev in native array
        scene.deselectDevice = function(dev, index) {
          scene.allDev[dev.type].push(dev);
          scene.actionsArr.splice(index, 1);
        };
        // restore devices, clear inputs
        scene.restoreData = function() {
          angular.forEach(allDev, function(devArray, key) {
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
            angular.forEach(scene.allDev[action.device.type], function(dev){
              if(dev.id === action.device.id){
                scene.allDev[action.device.type].splice(scene.allDev[action.device.type].indexOf(dev), 1);
              }
            });
            // if (action.device.type === 'light') {
            //   angular.forEach(scene.allLights, function(lightDev) {
            //     if (action.device.id === lightDev.id) {
            //       scene.allLights.splice(scene.allLights.indexOf(lightDev), 1);
            //     }
            //   });
            // } else if (action.device.type === 'switch') {
            //   angular.forEach(scene.allSwitches, function(switchDev) {
            //     if (action.device.id === switchDev.id) {
            //       scene.allSwitches.splice(scene.allSwitches.indexOf(switchDev), 1);
            //     }
            //   })
            // }
            scene.actionsArr.push(action);
          });
          console.log(scene.actionsArr);
          console.log(scene.allDev);
          newSceneName.value = sceneObj.name;
          $('#display-scenes').collapse('toggle');
          $('#add-new-scene').collapse('toggle');
        });

        /* get data */
        var allDev = dataService.allDev();
        var allRemotes = dataService.allCustomRemotes();
        scene.allScenes = dataService.scenes();
        scene.allDev = {};

        if (allDev && allRemotes) {
          angular.forEach(allDev, function(devArray, key) {
            scene.allDev[key] = devArray.slice(0);
          });
          // scene.allLights = allDev.light ? allDev.light.slice(0) : [];
          // scene.allSwitches = allDev.switch ? allDev.switch.slice(0) : [];
          // scene.allTvRemotes = allRemotes.tv ? allRemotes.tv.slice(0) : [];
        }
        /* wait on socket to connect than get data */
        if (!allDev || !scene.allScenes) {
          dataService.dataPending().then(function() {

            allDev = dataService.allDev();
            allRemotes = dataService.allCustomRemotes();
            scene.allScenes = dataService.scenes();

            angular.forEach(allDev, function(devArray, key) {
              scene.allDev[key] = devArray.slice(0);
            });
            console.log(scene.allDev);
            // scene.allLights = allDev.light ? allDev.light.slice(0) : [];
            // scene.allSwitches = allDev.switch ? allDev.switch.slice(0) : [];
            // scene.allTvRemotes = allRemotes.tv ? allRemotes.tv.slice(0) : [];
          });
        }
      }
    ]);
}());
