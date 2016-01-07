(function(){
  "use strict";

  angular
    .module('services')
    .directive('sShutter', [function(){
      return{
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/scene-schedule-dev/scene-shutter.html',
        scope: {
          shinfo: '='
        },
        link: function(scope, elem, attr){

          scope.shutterIcon = scope.shinfo.value < 50 ? 'img/device/shutter-on.png' : 'img/device/shutter-off.png';
          
          scope.shutterOpen = function(shutter){
            scope.$emit('deviceAction', shutter, 'openShutter');
          }

          scope.shutterClose = function(shutter){
            scope.$emit('deviceAction', shutter, 'closeShutter');
          };

          scope.shutterStop = function(shutter){
            scope.$emit('deviceAction', shutter, 'stopShutter')
          };
        }
      }
    }])
}());
