(function() {
  "use strict";

  angular
    .module('services')
    .directive('sThermostat', [function() {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/scene-schedule-dev/scene-thermostat.html',
        scope: {
          tinfo: '='
        },
        require: '^addScene',
        controllerAs: 'sceneThermostatCtrl',
        controller: ['$scope', function($scope) {

          var sceneThermostatCtrl = this;
          var deviceObj = $scope.tinfo;
          /**
           * @name tempUp
           * @desc increase temperature
           * @type {function}
           * @param {devObj} deviceObj
           */
          function tempUp(devObj) {
            if (devObj.target < 32) {
              devObj.target++;
            }
          }
          /**
           * @name tempDown
           * @desc decrease temperature
           * @type {function}
           * @param {devObj} device object
           */
          function tempDown(devObj) {
            if (devObj.target > 18) {
              devObj.target--;
            }
          }

          // exports
          sceneThermostatCtrl.deviceObj = deviceObj;
          sceneThermostatCtrl.tempUp = tempUp;
          sceneThermostatCtrl.tempDown = tempDown;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = scope.tinfo;
          var setBtn = elem[0].querySelectorAll('.device-btn-opt')[1];

          /**
           * @name setBtn
           * @desc set target temp, add to scene
           * @type {event}
           */
          setBtn.addEventListener('click', function() {
            ctrl.addDeviceToScene(deviceObj, 'setThermostatValue', deviceObj.target);
            scope.$apply();
          }, false);
        }
      }
    }])
}());
