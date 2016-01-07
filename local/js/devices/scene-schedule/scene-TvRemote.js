(function() {
  "use strict";

  angular
    .module('services')
    .directive('sTvremote', ['$rootScope', '$state', function($rootScope, $state) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/scene-schedule-dev/scene-TVremote.html',
        scope: {
          tvremote: '='
        },
        link: function(scope, elem, attr) {


          scope.quickRadioBtn = 'ch';
          var quickKeys = ['POWER', 'CHUP', 'CHDOWN', 'VOLUP', 'VOLDOWN'];

          angular.forEach(quickKeys, function(key) {
            if (scope.tvremote.keys.indexOf(key) === -1) {
              document.getElementById('remote-quick-' + key)
                .classList.add('remote-btn-inactive');
              document.getElementById('remote-quick-' + key).id = 'remote-quick-' + scope.tvremote.count + '-' + key;
            } else {
              document.getElementById('remote-quick-' + key).id = 'remote-quick-' + scope.tvremote.count + '-' + key;
            }
          });

          scope.remoteAction = function(rem, key) {
            if (scope.tvremote.keys.indexOf(key) !== -1) {
              scope.$emit('deviceAction', rem, 'sendKey', key);
            } else {
              return;
            }
          };
        }
      }
    }]);
}());
