(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('NHomeCtrl', ['$scope', '$rootScope', '$state', 'dataService', 'socket', function($scope, $rootScope, $state, dataService, socket) {

      var God = this;
      //God.activeRoomSensors = [];
      var sideBar = document.querySelector('.frame-sidebar');
      var wentOffline, serverActiveLog = sessionStorage.sessionActionLog ? JSON.parse(sessionStorage.sessionActionLog) : {};

      // connect to socket
      dataService.socketConnect().then(function() {
        socketEmits();
      });

      /* SET DEFAULT VALUES */

      //set active room
      // if (sessionStorage.activeRoom) {
      //   God.activeRoom = {
      //     name: JSON.parse(sessionStorage.activeRoom).name,
      //     id: JSON.parse(sessionStorage.activeRoom).id
      //   }
      // } else {
      //   God.activeRoom = {
      //     name: 'Dashboard',
      //     id: 'dashboard'
      //   };
      // }
      /* after server claim reload and rename */
      if (sessionStorage.newServerName && God.activeServer.name === sessionStorage.newServerName) {
        console.log(sessionStorage.newServerName);
        socket.emit3('configSet', 'name', sessionStorage.newServerName, function(data) {
          console.log(data);
        });
        sessionStorage.removeItem('newServerName');
      };

      God.sessionActionLog = sessionStorage.sessionActionLog ? JSON.parse(sessionStorage.sessionActionLog)[God.activeServer.id] ? JSON.parse(sessionStorage.sessionActionLog)[God.activeServer.id] : [] : [];

      /* request data for frame from server */
      function socketEmits() {
        /* get servers */
        socket.emit('getServers', null, function(servers) {
          God.allServers = servers;
        });
        /* get weather */
        socket.emit('getWeather', null, function(weatherInfo) {
          God.weather = weatherInfo;
        });
        /* get alarm state */
        socket.emit('isAlarmEnabled', null, function(alarmState) {
          God.alarmState = alarmState;
        });
        /* listen for action log updates */
        socket.on('actionLogUpdate', function(newAction) {
          console.log(newAction);
          God.sessionActionLog.unshift(newAction);
          serverActiveLog[God.activeServer.id] = God.sessionActionLog;
          sessionStorage.sessionActionLog = JSON.stringify(serverActiveLog);
        });
        /* server offline notification */
        socket.on('serverOnline', function(online) {
          console.log(online);
          if (!online) {
            God.serverOffline = true;
            wentOffline = true;
            document.querySelector('.frame-wrap').style.backgroundColor = '#ad3642';
          } else {
            God.serverOffline = false;
            if (wentOffline) {
              location.reload(true);
              document.querySelector('.frame-wrap').style.backgroundColor = '#1362AC'
              wentOffline = false;
            }
          }
        });
      };

      /* filter sensors by catId */
      // function filterSensorsByCatId(catId) {
      //   God.activeRoomSensors = [];
      //   angular.forEach(God.allSensors, function(sensor) {
      //     angular.forEach(sensor.categories, function(sensorCategoiresId) {
      //       if (sensorCategoiresId === catId) {
      //         God.activeRoomSensors.push(sensor);
      //       }
      //     })
      //   });
      // };
      /* add new category */
      // God.addCategory = function() {
      //   var newCategoryName = document.getElementById('add-category-name');
      //   socket.emit('catAdd', {
      //     name: newCategoryName.value
      //   }, function(newCatId) {
      //     var newCat = {
      //       id: newCatId,
      //       name: newCategoryName.value
      //     };
      //     God.categories.push(newCat);
      //     newCategoryName.value = '';
      //   });
      // };
      //
      // /* delete category */
      // God.deleteCategorie = function(category) {
      //   deleteRoomClickCount += 1;
      //   if (deleteRoomClickCount === 2) {
      //     socket.emit('catDelete', category.id, function(data) {
      //       angular.forEach(God.categories, function(cat) {
      //         if (cat.id === category.id) {
      //           God.categories.splice(God.categories.indexOf(cat), 1);
      //         }
      //       });
      //     });
      //     God.activeRoom = {
      //       name: 'Dashboard',
      //       id: 'dashboard'
      //     };
      //     $scope.$broadcast('filterData', God.activeRoom.id);
      //     $state.go('frame.dashboard');
      //   }
      // };
      //
      // /* edit category */
      // God.editCategory = function() {
      //   socket.emit('catUpdate', God.activeRoom.id, {
      //     name: God.activeRoom.name
      //   });
      //   angular.forEach(God.categories, function(category) {
      //     if (category.id === God.activeRoom.id) {
      //       category.name = God.activeRoom.name;
      //     }
      //   });
      // };

      /* add server name and id to local storage and reload page */
      God.switchServer = function(server) {
        sessionStorage.activeServer = JSON.stringify(server);
        sessionStorage.removeItem('activeRoom');
        location.reload(true);
      };

      /* turn alarm on/off */
      God.alarmStateToggle = function() {
        if (!God.alarmState) {
          socket.emit('enableAlarm');
          God.alarmState = true;
        } else {
          socket.emit('disableAlarm');
          God.alarmState = false;
        }
      };
      /* logout user */
      God.logout = function() {
        $state.go('login');
        sessionStorage.removeItem('activeServer');
        sessionStorage.removeItem('userInfoData');
        sessionStorage.removeItem('gravatar');
        dataRequest.logout()
          .then(function(reponse) {
            location.reload();
          });
      };

      God.toggleMenu = function() {
        sideBar.classList.toggle('active');
      };

      /* CUSTOM EMITS */

      /* name or email changed */
      $scope.$on('newUserProfile', function(event, userProfile) {
        God.userInfoData.user_name = userProfile.username;
        God.userInfoData.email = userProfile.email;
        sessionStorage.userInfoData = JSON.stringify(God.userInfoData);
      });
      /* new avatar */
      $scope.$on('newAvatar', function(event, newAvatar) {
        God.userInfoData.avatar = newAvatar;
        document.querySelector('.user-avatar').style.backgroundImage = 'url(' + newAvatar + ')';
        sessionStorage.userInfoData = JSON.stringify(God.userInfoData);
      });
      /* server claimed */
      $scope.$on('addNewServer', function(event, newServer) {
        God.allServers.push(newServer);
      });
      /* active server name changed */
      $scope.$on('newServerName', function(event, newServerName) {
        God.activeServer.name = newServerName;
        sessionStorage.activeServer = JSON.stringify(God.activeServer);

        angular.forEach(God.allServers, function(server) {
          if (server.id === God.activeServer.id) {
            server.name = newServerName;
          }
        });
      });

      /* remove active room class */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (window.innerWidth < 992) {
          sideBar.classList.remove('active');
        }
      });
    }]);
}());
