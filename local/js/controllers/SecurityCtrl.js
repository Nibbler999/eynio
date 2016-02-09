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

      // get data
      security.data = dataService.getData();
      console.log(security.data);

      // if no data, wait on socket
      if (!security.data.getDevicesObj || !security.data.getRecordings) {
        dataService.getDevicesEmit().then(function(devices) {
            security.data.getDevicesObj = devices;

            dataService.getRecordingsEmit().then(function(recordings) {
              security.data.getRecordings = recordings;
            })
          })
          // dataService.getServerEmits();
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
      }
    }]);
}());
