(function() {
  "use strict";

  angular
    .module('services')
    .directive('ssTvremote', ['$rootScope', '$state', function($rootScope, $state){
      return{
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/scene-schedule-dev/sce-sch-TVremote.html',
        scope:{
          tvremote: '='
        },
        link: function(scope, elem, attr){

          scope.tvremote.scene_select = false;
          scope.tvremote.schedule_select = false;
          scope.tvremote.active_key = null;

          var btns = document.getElementsByClassName('remote-btn');

          scope.toggleSelect = function() {
            if ($state.current.name === 'frame.schedule') {
              if (scope.tvremote.schedule_select) {
                scope.tvremote.schedule_select = false;
              } else {
                scope.tvremote.schedule_select = true;
              }
            } else if ($state.current.name === 'frame.scenes') {
              if (scope.tvremote.scene_select) {
                scope.tvremote.scene_select = false;
              } else {
                scope.tvremote.scene_select = true;
              }
            }
          };

          scope.tvActiveKey = function(count, key){
            angular.forEach(btns, function(btn){
              btn.classList.remove('ss-active-btn');
            });

            var activeKey = document.getElementById('rem-' + count + '-' + key.toLowerCase());
            if(activeKey.classList.contains('remote-btn-active')){
              activeKey.classList.add('ss-active-btn');

              scope.tvremote.active_key = key;
            }
          };

          scope.$on('clearData', function(event){
            scope.tvremote.active_key = null;
            angular.forEach(btns, function(btn){
              btn.classList.remove('ss-active-btn');
            });

            scope.remote = false;
            scope.numpad = false;
          });

          var keys = ["POWER", "TOOLS", "SOURCE", "INFO", "UP", "DOWN", "LEFT", "RIGHT", "OK", "RETURN", "EXIT", "SETTINGS", "MENU", "MUTE", "TXT", "VOLUP", "VOLDOWN", "CHUP", "CHDOWN", "NUM_0", "NUM_1", "NUM_2", "NUM_3", "NUM_4", "NUM_5", "NUM_6", "NUM_7", "NUM_8", "NUM_9"];

          /* change id of multiple remotes by count */
          angular.forEach(keys, function(key) {
            document.getElementById('rem-' + key.toLowerCase()).id = 'rem-' + scope.tvremote.count + '-' + key.toLowerCase();
          });

          /* add class active on learned keys */
          angular.forEach(scope.tvremote.keys, function(key) {
            document.getElementById('rem-' + scope.tvremote.count + '-' + key.toLowerCase()).classList.add('remote-btn-active');
          });
        }
      }
    }]);
}());
