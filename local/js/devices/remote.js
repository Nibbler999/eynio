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
            tvinfo: '='
          },
          link: function(scope, elem, attr) {

            scope.currentState = $state.current.name;
            scope.learningMode = false;
            scope.quickRadioBtn = 'ch';
            scope.deviceScheduleRepeat = 'daily';

            var keys = ["POWER", "SOURCE", "UP", "DOWN", "LEFT", "RIGHT", "OK", "MENU", "VOLUP", "VOLDOWN", "CHUP", "CHDOWN", "NUM_0", "NUM_1", "NUM_2", "NUM_3", "NUM_4", "NUM_5", "NUM_6", "NUM_7", "NUM_8", "NUM_9"];
            var quickKeys = ['POWER', 'CHUP', 'CHDOWN', 'VOLUP', 'VOLDOWN'];

            /* change id of multiple remotes by count */
            angular.forEach(keys, function(key) {
              if (scope.tvinfo.keys.indexOf(key) === -1) {
                document.getElementById('remote-' + key)
                  .classList.add('remote-btn-inactive');
                document.getElementById('remote-' + key).id = 'remote-' + scope.tvinfo.count + '-' + key;
              } else {
                document.getElementById('remote-' + key).id = 'remote-' + scope.tvinfo.count + '-' + key;
              }
            });

            angular.forEach(quickKeys, function(key) {
              if (scope.tvinfo.keys.indexOf(key) === -1) {
                document.getElementById('remote-quick-' + key)
                  .classList.add('remote-btn-inactive');
                document.getElementById('remote-quick-' + key).id = 'remote-quick-' + scope.tvinfo.count + '-' + key;
              } else {
                document.getElementById('remote-quick-' + key).id = 'remote-quick-' + scope.tvinfo.count + '-' + key;
              }
            });

              scope.cRemoteAction = function(remoteId, key) {
                if (scope.learningMode) {
                  scope.learnKey = key;
                  socket.emit('learnKey', remoteId, key, function(data) {
                    console.log(data);
                  });
                } else {
                  if (scope.tvinfo.keys.indexOf(key) !== -1) {
                    socket.emit('sendKey', remoteId, key);
                  }
                }
              };

              scope.toggleAddToFavorites = function(favorites, devId) {
                if (favorites) {
                  socket.emit4('setUserProperty', devId, 'favorites', true);
                } else {
                  socket.emit4('setUserProperty', devId, 'favorites', false);
                }
              };

              // check hours to prevent schedule in the past
              scope.checkHours = function(e) {
                if (scope.deviceScheduleRepeat === 'once') {
                  var date = new Date();
                  e.target.min = date.getHours();
                }
              };

              // check minutes to prevent schedule in the past
              scope.checkMinutes = function(e) {
                if (scope.deviceScheduleRepeat === 'once') {
                  var date = new Date();
                  var h = parseInt(document.getElementById('device-schedule-hours-' + scope.tvinfo.id).value);
                  if (h <= date.getHours()) {
                    e.target.min = date.getMinutes() + 1;
                  }
                }
              };
              scope.quickSchedule = function(dev, state) {
                var h = document.getElementById('device-schedule-hours-' + scope.tvinfo.id);
                var m = document.getElementById('device-schedule-minutes-' + scope.tvinfo.id);
                var date = new Date();
                date.setHours(parseInt(h.value), parseInt(m.value), 0, 0);

                var job = {
                  name: dev.name,
                  type: 'remote',
                  dateTime: {
                    hour: parseInt(h.value),
                    minute: parseInt(m.value),
                    dayOfWeek: []
                  },
                  actions: [{
                    emit_name: 'sendKey',
                    params: [dev.id, state]
                  }]
                };

                if (scope.deviceScheduleRepeat === 'once') {
                  job.dateTime = Date.parse(date);
                }
                console.log(job);
                socket.emit('addNewJob', job, function(response) {
                  if (response) {
                    scope.scheduleSuccess = true;
                    h.value = '';
                    m.value = '';
                  }
                  setTimeout(function() {
                    scope.scheduleSuccess = false;
                  }, 250);
                });
              };

            socket.on('IRKeyLearned', function(keyLearned) {
              if (keyLearned.remoteid === scope.tvinfo.id) {
              window.navigator.vibrate(200);
                scope.tvinfo.keys.push(keyLearned.key);
                document.getElementById('remote-' + scope.tvinfo.count + '-' + keyLearned.key).classList.remove('remote-btn-inactive');

                if (quickKeys.indexOf(keyLearned.key) !== -1) {
                  document.getElementById('remote-quick-' + scope.tvinfo.count + '-' + keyLearned.key).classList.remove('remote-btn-inactive');
                }
                scope.learnKey = false;
              }
            });
          }
        }
      }
    ]);
}());
