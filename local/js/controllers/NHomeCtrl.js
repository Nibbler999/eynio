(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('NHomeCtrl', ['$scope', '$rootScope', '$state', 'dataService', 'socket', function($scope, $rootScope, $state, dataService, socket) {

      var God = this;
      God.activeRoomSensors = [];
      var activeCat, notActiveCat, wentOffline, deleteRoomClickCount;
      if (sessionStorage.activeServer) {
        var activeServer = JSON.parse(sessionStorage.activeServer);
      }
      /* HELPER FUNCTIONS */

      /* request data from server */
      var socketData = function(token, serverId) {
        dataService.socketConnect(token, serverId).then(function() {

          /* get weather */
          socket.emit('getWeather', null, function(weatherInfo) {
            God.weather = weatherInfo;
          });
          /* get alarm state */
          socket.emit('isAlarmEnabled', null, function(alarmState) {
            God.alarmState = alarmState;
          });
          /* get categories */
          socket.emit('getCategories', null, function(categories) {
            God.categories = categories;
          });
          /* sensor value change */
          socket.on('sensorValue', function(sensorChange) {
            angular.forEach(God.allSensors, function(sensor) {
              if (sensor.id === sensorChange.id) {
                sensor.value = sensorChange.value;
              }
            });
          });

          God.allSensors = dataService.sensors();
        });
      };

      /* filter sensors by catId */
      var filterSensorsByCatId = function(catId) {
        God.activeRoomSensors = [];
        angular.forEach(God.allSensors, function(sensor) {
          angular.forEach(sensor.categories, function(sensorCategoiresId) {
            if (sensorCategoiresId === catId) {
              God.activeRoomSensors.push(sensor);
            }
          })
        });
      };

      /* SET DEFAULT VALUES */
      God.lastState = 'frame.dashboard';

      if (sessionStorage.activeRoom) {
        God.activeRoom = {
          name: JSON.parse(sessionStorage.activeRoom).name,
          id: JSON.parse(sessionStorage.activeRoom).id
        }
      } else {
        God.activeRoom = {
          name: 'Dashboard',
          id: 'dashboard'
        };
      }

      socketData();

      /* after server clam reload */
      if (sessionStorage.newServerName && God.activeServer.name === sessionStorage.newServerName) {
        console.log(sessionStorage.newServerName);
        socket.emit3('configSet', 'name', sessionStorage.newServerName, function(data) {
          console.log(data);
        });
        sessionStorage.removeItem('newServerName');
      };

      /* filter devices by category */
      God.filterDevByCategory = function(category) {
        deleteRoomClickCount = 0;
        God.activeRoom = {
          name: category.name,
          id: category.id
        };
        sessionStorage.activeRoom = JSON.stringify(category);
        filterSensorsByCatId(category.id);

        $state.go('frame.dashboard');
        $scope.$broadcast('filterData', category.id);
        notActiveCat = document.getElementsByClassName('category');
        angular.forEach(notActiveCat, function(cat) {
          cat.classList.remove('category-active');
        });
        activeCat = document.getElementById(category.name);
        activeCat.classList.add('category-active');
      };

      /* add new category */
      God.addCategory = function() {
        var newCategoryName = document.getElementById('add-category-name');
        socket.emit('catAdd', {
          name: newCategoryName.value
        }, function(newCatId) {
          var newCat = {
            id: newCatId,
            name: newCategoryName.value
          };
          God.categories.push(newCat);
          newCategoryName.value = '';
        });
      };

      /* delete category */
      God.deleteCategorie = function(category) {
        deleteRoomClickCount += 1;
        if (deleteRoomClickCount === 2) {
          socket.emit('catDelete', category.id, function(data) {
            angular.forEach(God.categories, function(cat) {
              if (cat.id === category.id) {
                God.categories.splice(God.categories.indexOf(cat), 1);
              }
            });
          });
          God.activeRoom = {
            name: 'Dashboard',
            id: 'dashboard'
          };
          $scope.$broadcast('filterData', God.activeRoom.id);
          $state.go('frame.dashboard');
        }
      };

      /* edit category */
      God.editCategory = function() {
        socket.emit('catUpdate', God.activeRoom.id, {
          name: God.activeRoom.name
        });
        angular.forEach(God.categories, function(category) {
          if (category.id === God.activeRoom.id) {
            category.name = God.activeRoom.name;
          }
        });
      };

      /* add server name and id to local storage and reload page */
      God.switchServer = function(server) {
        sessionStorage.activeServer = JSON.stringify(server);
        sessionStorage.activeRoom = JSON.stringify({
          name: 'Dashboard',
          id: 'dashboard'
        });
        location.reload(true);
      };

      /* turn alarm on/off */
      God.alarmStateToggle = function() {
        if (God.alarmState) {
          socket.emit('enableAlarm');
        } else {
          socket.emit('disableAlarm');
        }
      };

      /* CUSTOM EMITS */

      /* server claimed */
      $scope.$on('addNewServer', function(event, newServer) {
        God.allServers.push(newServer);
      });
      /* active server name changed */
      $scope.$on('newServerName', function(event, newServerName) {
        God.activeServer = newServerName;
        console.log(newServerName);
      });
      /* remove active room class */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        God.lastState = from.name;
        if (to.name !== 'frame.dashboard') {
          notActiveCat = document.getElementsByClassName('category');
          angular.forEach(notActiveCat, function(cat) {
            cat.classList.remove('category-active');
            God.activeRoom.id = null;
          });
        }
      });
    }]);
}());
