(function() {
  "use strict";

  angular
    .module('services')
    .directive('sShutter', [function() {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/scene-schedule-dev/scene-shutter.html',
        scope: {
          shinfo: '='
        },
        require: '^addScene',
        controllerAs: 'sceneShutterCtrl',
        controller: ['$scope', function($scope) {

          var sceneShutterCtrl = this;
          var deviceObj = $scope.shinfo;

          sceneShutterCtrl.deviceIcon = deviceObj.value < 50 ? 'img/device/shutter-on.png' : 'img/device/shutter-off.png';

          // exports
          sceneShutterCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = scope.shinfo;
          // action btns
          var btns = elem[0].querySelectorAll('.device-btn-opt');
          var openShutterBtn = btns[0];
          var stopShutterBtn = btns[1];
          var closeShutterBtn = btns[2];

          /**
           * @name openShutter
           * @desc open shutter add to scenes
           * @type {event}
           */
          openShutterBtn.addEventListener('click', function() {
            ctrl.addDeviceToScene(deviceObj, 'openShutter');
            scope.$apply();
          }, false);
          /**
           * @name stopShutterBtn
           * @desc stop shutter add to scenes
           * @type {event}
           */
          stopShutterBtn.addEventListener('click', function() {
            ctrl.addDeviceToScene(deviceObj, 'stopShutter');
            scope.$apply();
          }, false);
          /**
           * @name closeShutterBtn
           * @desc close shutter add to scenes
           * @type {event}
           */
          closeShutterBtn.addEventListener('click', function() {
            ctrl.addDeviceToScene(deviceObj, 'closeShutter');
            scope.$apply();
          }, false);
        }
      }
    }])
}());
