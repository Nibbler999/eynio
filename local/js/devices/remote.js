(function() {
  "use strict";

  angular
    .module('services')
    .directive('remote', [
      'dataService', 'socket', '$state',
      function(dataService, socket, $state) {
        return {
          restrict: 'E',
          replace: true,
          templateUrl: 'directive/devices/remote.html',
          scope: {
            crinfo: '='
          },
          link: function(scope, elem, attr) {

            scope.currentState = $state.current.name;
            scope.learningMode = false;
            scope.quickRadioBtn = 'ch';

            var keys = ["POWER", "SOURCE", "UP", "DOWN", "LEFT", "RIGHT", "OK", "MENU", "VOLUP", "VOLDOWN", "CHUP", "CHDOWN", "NUM_0", "NUM_1", "NUM_2", "NUM_3", "NUM_4", "NUM_5", "NUM_6", "NUM_7", "NUM_8", "NUM_9"];
            var quickKeys = ['POWER', 'CHUP', 'CHDOWN', 'VOLUP', 'VOLDOWN'];

            /* change id of multiple remotes by count */
            angular.forEach(keys, function(key) {
              if (scope.crinfo.keys.indexOf(key) === -1) {
                document.getElementById('remote-' + key)
                  .classList.add('remote-btn-inactive');
                document.getElementById('remote-' + key).id = 'remote-' + scope.crinfo.count + '-' + key;
              } else {
                document.getElementById('remote-' + key).id = 'remote-' + scope.crinfo.count + '-' + key;
              }
            });

            angular.forEach(quickKeys, function(key) {
              if (scope.crinfo.keys.indexOf(key) === -1) {
                document.getElementById('remote-quick-' + key)
                  .classList.add('remote-btn-inactive');
                document.getElementById('remote-quick-' + key).id = 'remote-quick-' + scope.crinfo.count + '-' + key;
              } else {
                document.getElementById('remote-quick-' + key).id = 'remote-quick-' + scope.crinfo.count + '-' + key;
              }
            });

            if ($state.current.name === 'frame.devices') {
              return false;
            } else {
              scope.cRemoteAction = function(remoteId, key) {
                if (scope.learningMode) {
                  scope.learnKey = key;
                  socket.emit('learnKey', remoteId, key, function(data) {
                    console.log(data);
                  });
                } else {
                  socket.emit('sendKey', remoteId, key);
                }
              };

              scope.toggleAddToFavorites = function(favorites, devId) {
                if (favorites) {
                  socket.emit4('setDeviceProperty', devId, 'favorites', true);
                } else {
                  socket.emit4('setDeviceProperty', devId, 'favorites', false);
                }
              };
            };

            socket.on('IRKeyLearned', function(keyLearned) {
              if (keyLearned.remoteid === scope.crinfo.id) {
                scope.crinfo.keys.push(keyLearned.key);
                document.getElementById('remote-' + scope.crinfo.count + '-' + keyLearned.key).classList.remove('remote-btn-inactive');

                if (quickKeys.indexOf(keyLearned.key) !== -1) {
                  document.getElementById('remote-quick-' + scope.crinfo.count + '-' + keyLearned.key).classList.remove('remote-btn-inactive');
                }
                scope.learnKey = false;
              }
            });
          }
        }
      }
    ]);
}());
