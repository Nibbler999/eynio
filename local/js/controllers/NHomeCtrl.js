(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('NHomeCtrl', ['$scope', '$rootScope', '$state', '$timeout', 'dataService', 'socket', function($scope, $rootScope, $state, $timeout, dataService, socket) {

      var God = this;

      God.data = {};
      //God.activeRoomSensors = [];
      var sideBar = document.querySelector('.frame-sidebar');
      var wentOffline;
      var serverActiveLog = sessionStorage.sessionActionLog ? JSON.parse(sessionStorage.sessionActionLog) : {};
      God.userInfoData = {};
      God.activeServer = {
        id: 1,
        name: 'no servers found'
      };
      God.allServers = [];
      // connect to socket
      dataService.socketConnect().then(function() {
        postSocketConnectAction();
      });

      /* SET DEFAULT VALUES */

      God.sessionActionLog = sessionStorage.sessionActionLog && JSON.parse(sessionStorage.sessionActionLog)[God.activeServer.id] ? JSON.parse(sessionStorage.sessionActionLog)[God.activeServer.id] : [];

      /* add server name and id to local storage and reload page */
      God.switchServer = function(server) {
        sessionStorage.activeServer = JSON.stringify(server);
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
        sessionStorage.removeItem('activeServer');
        sessionStorage.removeItem('userInfoData');
        sessionStorage.removeItem('gravatar');
        dataRequest.logout()
          .then(function(response) {
            if (response.data.success) {
              socket.disconnect();
              //dataService.logOut();
              God.data = {};
              $state.go('login');
              $timeout(function() {
                location.reload();
              }, 50);
            }
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

      // remove server form found servers
      $scope.$on('serverClaimed', function(event, server) {
        God.foundNewServer.splice(God.foundNewServer.indexOf(server), 1);
        God.data.getServers.push(server);
        God.userInfoData.servers.push(server);
        sessionStorage.userInfoData = JSON.stringify(God.userInfoData);
      });

      /* remove active room class */
      $rootScope.$on('$stateChangeStart', function(event, to, toParams, from, fromParams) {
        if (!God.activeServer.id) {
          event.preventDefault();
        } else {
          if (window.innerWidth < 992) {
            sideBar.classList.remove('active');
          }
        }
      });

      function postSocketConnectAction() {
        console.log('post actions');
        //socketEmits();
        // God.allServers = dataService.getServers();
        // God.weather = dataService.getWeather();
        // God.alarmState = dataService.isAlarmEnabled();
        // God.serverOffline = dataService.serverOnline();
        /* listen for server online offline status */
        socket.on('serverOnline', function(online) {
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

        socket.on('actionLogUpdate', function(newAction) {
          God.sessionActionLog.unshift(newAction);
          serverActiveLog[God.activeServer.id] = God.sessionActionLog;
          sessionStorage.sessionActionLog = JSON.stringify(serverActiveLog);
        });

        /* register endpoint for push notifications */
        if (sessionStorage.GCMReg && sessionStorage.GCMReg != 'undefined') {
          socket.emit('GCMRegister', sessionStorage.GCMReg);
        }

        dataService.setAllListeners();
        God.data = dataService.getData();
      };
    }]);
}());
