(function() {
  "use strict";

  angular
    .module('services')
    .directive('sSwitch', [function() {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/scene-schedule-dev/scene-switch.html',
        scope: {
          sinfo: '='
        },
        require: '^addScene',
        controllerAs: 'sceneSwitchCtrl',
        controller: ['$scope', function($scope) {

          var sceneSwitchCtrl = this;
          var deviceObj = $scope.sinfo;

          /**
           * @name setDeviceIcon
           * @desc set device icon depending on device state
           * @type {function}
           */
          function setDeviceIcon() {
            if (deviceObj.value) {
              sceneSwitchCtrl.deviceIcon = 'img/device/switch-on.png';
            } else {
              sceneSwitchCtrl.deviceIcon = 'img/device/switch-off.png';
            }
          };
          setDeviceIcon();
          // exports
          sceneSwitchCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = scope.sinfo;
          // action btns
          var toggleBtn = elem[0].querySelector('.device-icon');
          var onBtn = elem[0].querySelectorAll('.device-btn')[0];
          var offBtn = elem[0].querySelectorAll('.device-btn')[1];

          /**
           * @name toggleBtn
           * @desc toggle switch state, add to scene
           * @type {event}
           */
          toggleBtn.addEventListener('click', function() {
            deviceObj.value = !deviceObj.value;
            ctrl.addDeviceToScene(deviceObj, 'setDevicePowerState', deviceObj.value);
            scope.$apply();
          }, false);
          /**
           * @name onBtn
           * @desc set switch state on, add to scene
           * @type {event}
           */
          onBtn.addEventListener('click', function() {
            deviceObj.value = true;
            ctrl.addDeviceToScene(deviceObj, 'setDevicePowerState', deviceObj.value);
            scope.$apply();
          }, false);
          /**
           * @name offBtn
           * @desc set switch state off, add to scene
           * @type {event}
           */
          offBtn.addEventListener('click', function() {
            deviceObj.value = false;
            ctrl.addDeviceToScene(deviceObj, 'setDevicePowerState', deviceObj.value);
            scope.$apply();
          }, false);
        }
      };
    }]);
}());
