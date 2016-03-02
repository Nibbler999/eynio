(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('SecurityCtrl', ['$scope', 'dataService', 'socket', function($scope, dataService, socket) {

      var security = this;

      var alarmDevices = [];

      // get alarm configuration
      socket.emit('getAlarmConfig', null, function(alarmConf) {
        console.log(alarmConf);
        security.alarmNotification = alarmConf.method;
        alarmDevices = alarmConf.devices;
      });

      // add sensors for triggering alarm
      security.toggleAddSensor = function(id) {
        if (alarmDevices.indexOf(id) === -1) {
          alarmDevices.push(id);
          socket.emit('setAlarmDevices', alarmDevices, function(response) {
            if (response) {
              $scope.$broadcast('sensorAdded', id);
            }
          });
        } else {
          alarmDevices.splice(alarmDevices.indexOf(id), 1);
          socket.emit('setAlarmDevices', alarmDevices, function(response) {
            $scope.$broadcast('sensorRemoved', id);
          });
        }
      };

      // load more recordings
      security.loadMoreRecordings = function() {
        var start = security.latestRecordings.length
        var end = security.latestRecordings.length + 20;
        security.latestRecordings = security.latestRecordings
          .concat(security.bigData.getRecordings.slice(start, end));
        // console.log(security.latestRecordings, security.latestRecordings.length);
      };
      // filter by date
      // security.filterByInput = function(e) {
      //   // console.log(security.filterBy);
      //   var filters = security.filterBy.split(',');
      //   security.filterName = filters[0];
      //   security.filterDay = filters[1] ? filters[1].split('/')[0] : undefined;
      //   security.filterMonth = filters[1] ? filters[1].split('/')[1] : undefined;
      //   console.log(security.filterName, security.filterDay, security.filterMonth);
      // };

      // get data
      security.data = dataService.getData();
      security.bigData = dataService.getBigData();
      security.latestRecordings = security.bigData.getRecordings ? security.bigData.getRecordings.slice(0, 20) : [];
      // if no data, wait on socket
      if (!security.data.getDevicesObj || !security.bigData.getRecordings) {
        dataService.getDevicesEmit().then(function(devices) {
          security.data.getDevicesObj = devices;
          console.log(security.data.getDevicesObj);
          dataService.getRecordingsEmit().then(function(recordings) {
            security.bigData.getRecordings = recordings;
            security.latestRecordings = security.bigData.getRecordings.slice(0, 20);
          });
        });
        dataService.getServerEmits();
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
      }
    }]);
}());
