(function() {
  "use strict";

  angular
    .module('services')
    .directive('alarm', ['socket', 'dataService', function(socket, dataService) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/alarm.html',
        scope: {
          ainfo: '='
        },
        controllerAs: 'alarmCtrl',
        controller: ['$scope', function($scope) {

          var alarmCtrl = this;
          var deviceObj = $scope.ainfo;

          alarmCtrl.deviceIcon = 'img/device/alarm-off.png';
          var alarmConfig = dataService.getData().getAlarmConfig;
          // if no alarm config, fetch alarm config
          if (!alarmConfig) {
            socket.emit('getAlarmConfig', null, function(response) {
              alarmConfig = response;
              setAlarmState(alarmConfig.devices);
            })
          } else {
            setAlarmState(alarmConfig.devices);
          }
          /**
           * @name setAlarmState
           * @desc set alarm icon depending if added to config or not
           * @type {function}
           * @param {alarmConfigDevs} alarm configuration devices
           */
          function setAlarmState(alarmConfigDevs) {
            angular.forEach(alarmConfigDevs, function(alarmDevId) {
              if (alarmDevId === deviceObj.id) {
                alarmCtrl.inAlarmConfig = true;
                alarmCtrl.deviceIcon = 'img/device/alarm-on.png';
              }
            })
          }
          /**
           * @name setDeviceToAlarmCfgToggle
           * @desc toggle device to and from alarm configuration
           * @type {function}
           * @param {devId} device id
           */
          function setDeviceToAlarmCfgToggle(devId) {
            if (alarmConfig.devices.indexOf(devId) === -1) {
              alarmConfig.devices.push(devId);
              socket.emit('setAlarmDevices', alarmConfig.devices, function(response) {
                if (response) {
                  alarmCtrl.inAlarmConfig = true;
                  alarmCtrl.deviceIcon = 'img/device/alarm-on.png';
                }
              });
            } else {
              alarmConfig.devices.splice(alarmConfig.devices.indexOf(devId), 1);
              socket.emit('setAlarmDevices', alarmConfig.devices, function(response) {
                if (response) {
                  alarmCtrl.inAlarmConfig = false;
                  alarmCtrl.deviceIcon = 'img/device/alarm-off.png';
                }
              })
            }
          }

          //  exports
          alarmCtrl.setDeviceToAlarmCfgToggle = setDeviceToAlarmCfgToggle;
          alarmCtrl.deviceObj = deviceObj;
        }]
      };
    }]);
}());
