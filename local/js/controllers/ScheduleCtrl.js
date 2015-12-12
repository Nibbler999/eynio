(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ScheduleCtrl', ['$rootScope', '$scope', 'socket', 'dataService', function($rootScope, $scope, socket, dataService) {

      var schedule = this;

      var daysArr = [];
      var itemsArr = [];
      schedule.actionsArr = [];
      var sceneScheduleTime;

      var newScene = document.querySelector('.new-scene');
      var newSceneName = document.getElementById('new-scene-name');
      var newSceneHours = document.getElementById('new-scene-hours');
      var newSceneMinutes = document.getElementById('new-scene-minutes');
      var newSceneDays = document.querySelectorAll('.new-scene-day');
      var newSceneSunset = document.getElementById('new-scene-sunset');
      var newSceneSunrise = document.getElementById('new-scene-sunrise');


      document.querySelector('.add-new-btn').onclick = function() {
        newScene.style.marginTop = '0%';
      };

      /* scene schedule days */
      angular.forEach(newSceneDays, function(day) {
        day.onclick = function() {
          getDays();
        }
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

      schedule.getSunsetSunrise = function(sunTime) {
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
      schedule.cancelSchedule = function() {

        newScene.style.marginTop = '100%';
        sceneScheduleTime = null;
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
        schedule.actionsArr = [];
      };

      schedule.selectedForScene = function(device, index) {
        console.log(device, index);

        if (device.type === 'switch') {
          schedule.actionsArr.push({
            device: device,
            'emit_name': 'setDevicePowerState',
            'params': [device.id, device.value]
          });
          schedule.allSwitches.splice(index, 1);
        } else if (device.type === 'light') {
          schedule.actionsArr.push({
            device: device,
            'emit_name': 'setDevicePowerState',
            'params': [device.id, device.state.on]
          });
          schedule.allLights.splice(index, 1);
        }
        console.log(schedule.actionsArr);
      };

      schedule.deselectDevice = function(deselectDev, index) {
        if (deselectDev.device.type === 'switch') {
          console.log(schedule.allSwitches);
          schedule.allSwitches.push(deselectDev.device);

          console.log(schedule.allSwitches);
        } else if (deselectDev.device.type === 'light') {
          schedule.allLights.push(deselectDev.device);
        }
        schedule.actionsArr.splice(index, 1);
      };

      schedule.addSchedule = function() {
        if (!schedule.actionsArr.length) {
          return
        } else {
          saveSchedule();
          socket.emit4('addNewJob', newSceneName.value, sceneScheduleTime, schedule.actionsArr, function(data) {
            console.log(data);
          });
          /* clear input data */
          newSceneName.value = '';
          angular.forEach(schedule.actionsArr, function(dev) {
            if (dev.device.type === 'switch') {
              schedule.allSwitches.push(dev.device);
            } else if (dev.device.type === 'light') {
              schedule.allLights.push(dev.device);
            }
          });
          schedule.actionsArr = [];
          sceneScheduleTime = null;
        }
      };

      /* get data */
      schedule.allSchedules = dataService.schedules() ? dataService.schedules() : dataService.dataPending().then(function() {
        schedule.allSchedules = dataService.schedules();
      });
    }]);
}());
