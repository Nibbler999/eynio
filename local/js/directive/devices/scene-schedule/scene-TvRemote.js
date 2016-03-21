(function() {
  "use strict";

  angular
    .module('services')
    .directive('sTvremote', ['$rootScope', '$state', function($rootScope, $state) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/scene-schedule-dev/scene-TVremote.html',
        scope: {
          tvremote: '='
        },
        require: '^addScene',
        controllerAs: 'sceneTvCtrl',
        controller: ['$scope', function($scope) {

          var sceneTvCtrl = this;
          var deviceObj = $scope.tvremote;
          var quickKeysRadioValue = 'ch';

          // exports
          sceneTvCtrl.deviceObj = deviceObj;
          sceneTvCtrl.quickKeysRadioValue = quickKeysRadioValue;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = scope.tvremote;
          var quickRemoteButtons = elem[0].querySelectorAll('[name=remote-quick-btn]');
          var quickKeys = ['POWER', 'CHUP', 'CHDOWN', 'VOLUP', 'VOLDOWN'];
          // add listeners on all quick keys and inactive class if not learned
          angular.forEach(quickRemoteButtons, function(btn) {
            if (deviceObj.keys.indexOf(btn.dataset.remoteKey) === -1) {
              btn.classList.add('remote-btn-inactive');
              btn.disabled = true;
            }
            /**
             * @name quick btn
             * @desc on click send key
             * @type {event}
             */
            btn.addEventListener('click', function() {
              ctrl.addDeviceToScene(deviceObj, 'sendKey', this.dataset.remoteKey);
              scope.$apply();
            }, false)
          });
        }
      }
    }]);
}());
