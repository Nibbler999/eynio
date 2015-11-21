(function() {
  "use strict";

  angular
    .module('services')
    .directive('scene', ['socket', 'dataService', '$rootScope', function(socket, dataService, $rootScope) {
      return {
        restrict: 'E',
        replace: true,
        scope: {
          scinfo: '='
        },
        templateUrl: 'directive/devices/scene.html',
        link: function(scope, elem, attr) {

          console.log(scope.scinfo);

          scope.setScene = function(sceneId) {
            socket.emit('setScene', sceneId);
          };

          scope.deleteScene = function(sceneId) {
            socket.emit('deleteScene', sceneId);
          };

          scope.editScene = function(scene) {
            $rootScope.$broadcast('editScene', scene);
          };
        }
      };
    }]);
}());
