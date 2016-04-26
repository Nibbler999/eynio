(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('NHomeCtrl', ['$scope', '$rootScope', '$state', '$timeout', 'dataRequest', 'dataService', 'socket', function($scope, $rootScope, $state, $timeout, dataRequest, dataService, socket) {

      var God = this;

      var sideBar = document.querySelector('.frame-sidebar');
      // var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      // var liveStreamImg = document.querySelector('.camera-live-stream');
      var wentOffline;
      var serverActiveLog = sessionStorage.sessionActionLog ? JSON.parse(sessionStorage.sessionActionLog) : {};
      God.allServers = [];
      // connect to socket
      if (sessionStorage.userInfoData) {
        God.userInfoData = JSON.parse(sessionStorage.userInfoData);
        God.activeServer = JSON.parse(sessionStorage.activeServer);
        God.activeServer.name = God.activeServer.name ? God.activeServer.name : 'no server found'

        if (God.activeServer.id) {
          dataService.socketConnect(God.userInfoData, God.activeServer).then(function() {
            postSocketConnectAction();
          });
        }
        // // check if reloaded
        // if (sessionStorage.activeServer && sessionStorage.activeServer !== 'undefined') {
        //   God.activeServer = JSON.parse(sessionStorage.activeServer);
        //
        //   /*if (God.activeServer.local && God.activeServer.ip_int) {
        //     dataService.localSocketConnect(God.activeServer.ip_int).then(function() {
        //       socketEmits();
        //     });
        //   } else {*/
        //   dataService.socketConnect(encodeURIComponent(God.userInfoData.token), God.activeServer.id, God.userInfoData.email).then(function() {
        //     socketEmits();
        //   });
        //   //}
        // } else if (God.userInfoData.servers.length) {
        //   /*if (God.userInfoData.servers[0].local && God.userInfoData.servers[0].ip_int) {
        //     dataService.localSocketConnect(God.userInfoData.servers[0].ip_int).then(function() {
        //       socketEmits();
        //     });
        //     God.activeServer = God.userInfoData.servers[0];
        //   } else {*/
        //   dataService.socketConnect(encodeURIComponent(God.userInfoData.token), God.userInfoData.servers[0].id, God.userInfoData.email).then(function() {
        //     socketEmits();
        //   });
        //   God.activeServer = God.userInfoData.servers[0];
        //   /*}*/
        // }
      } else {
        $state.go('login');
      }

      /* SET DEFAULT VALUES */
      //Set user avatar
      document.querySelector('.user-avatar').style.backgroundImage = 'url(' + God.userInfoData.avatar + ')';

      God.sessionActionLog = sessionStorage.sessionActionLog && JSON.parse(sessionStorage.sessionActionLog)[God.activeServer.id] ? JSON.parse(sessionStorage.sessionActionLog)[God.activeServer.id] : [];

      /* add server name and id to local storage and reload page */
      God.switchServer = function(server) {
        sessionStorage.activeServer = JSON.stringify(server);
        location.reload(true);
      };

      /* logout user */
      God.logout = function() {
        sessionStorage.removeItem('activeServer');
        sessionStorage.removeItem('userInfoData');
        // sessionStorage.removeItem('gravatar');
        dataRequest.logout()
          .then(function(response) {
            if (response.data.success) {
              socket.disconnect();
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
      /* active server name changed */
      $scope.$on('newServerName', function(event, newServerName) {
        God.activeServer.name = newServerName;
        sessionStorage.activeServer = JSON.stringify(God.activeServer);

        angular.forEach(God.userInfoData.servers, function(server) {
          if (server.id === God.activeServer.id) {
            server.name = newServerName;
          }
        });
      });

      /* remove active room class */
      $rootScope.$on('$stateChangeStart', function(event, to, toParams, from, fromParams) {
        if (!God.activeServer.id) {
          event.preventDefault();
        }
        if (window.innerWidth < 992) {
          sideBar.classList.remove('active');
        }
        $scope.$broadcast('closeModals');
      });

      function postSocketConnectAction() {
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
        // dataService.getServerEmits().then(function() {
        //   God.data = dataService.getData();
        //   God.bigData = dataService.getBigData();
        //   God.userInfoData = God.data.user;
        // });
      };
    }]);
}());
