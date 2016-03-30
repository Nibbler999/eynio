(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DashboardCtrl', ['dataService', '$stateParams', 'socket', function(dataService, $stateParams, socket) {
      var dashboard = this;


      /**
       * @name setAlarmOff
       * @desc turn off alarm
       * @type {function}
       */
      dashboard.setAlarmOff = function(alarmState) {
        if (alarmState) {
          socket.emit('disableAlarm', null, function(response) {
            if (response) {
              dashboard.data.isAlarmEnabled = false;
            }
          })
        }
      };
      /**
       * @name setAlarmOn
       * @desc turn on alarm
       * @type {function}
       */
      dashboard.setAlarmOn = function(alarmState) {
        if (!alarmState) {
          socket.emit('enableAlarm', null, function(response) {
            if (response) {
              dashboard.data.isAlarmEnabled = true;
            }
          })
        }
      }

      // get data
      dashboard.data = dataService.getData();
      dashboard.bigData = dataService.getBigData();
      // if data, sort it
      if (dashboard.data.getDevicesArray) {
        // sort uncategorised
        dashboard.uncategorised = dashboard.data.getDevicesArray.filter(function(dev) {
          return dev.category === null
        });
        // get 5 scenes
        dashboard.getScenes = dashboard.data.getScenes ? dashboard.data.getScenes.slice(0, 5) : [];
        // get 5 schedules
        dashboard.getSchedules = dashboard.data.getSchedules ? dashboard.data.getSchedules.slice(0, 5) : [];
        // get 5 last recordings
        dashboard.getRecordings = dashboard.bigData.getRecordings ? dashboard.bigData.getRecordings.slice(0, 5) : [];
        // if from login, show data from IDB than fetch new
        if ($stateParams.lastRoute) {
          fetchData();
        }
      } else {
        fetchData();
      }
      /**
       * @name fetchData
       * @desc async fetching data from server via socket
       * @type {function}
       */
      function fetchData() {
        dataService.getDevicesEmit().then(function(devices) {
          dataService.getRecordingsEmit().then(function() {
            dashboard.data = dataService.getData();
            dashboard.bigData = dataService.getBigData();
            dashboard.uncategorised = dashboard.data.getDevicesArray.filter(function(dev) {
              return !dev.category
            });
            dashboard.getScenes = dashboard.data.getScenes ? dashboard.data.getScenes.slice(0, 5) : [];
            dashboard.getSchedules = dashboard.data.getSchedules ? dashboard.data.getSchedules.slice(0, 5) : [];
            dashboard.getRecordings = dashboard.bigData.getRecordings ? dashboard.bigData.getRecordings.slice(0, 5) : [];
          });
        });
        // run other data fetches
        dataService.getServerEmits();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getCategoriesEmit();
      }
    }]);
}());
