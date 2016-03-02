(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('SettingsServerCtrl', ['$scope', '$rootScope', '$http', '$timeout', '$state', 'socket', 'dataService', function($scope, $rootScope, $http, $timeout, $state, socket, dataService) {

      var server = this;
      var activityLogDay = 1;
      server.deleteServerCount = 0;
      server.upToDate = true;

      /* get server data, updates */
      socket.emit('getServerStatus', null, function(serverStatus) {
        console.log(serverStatus);
        server.serverInfoData = serverStatus;
        var url = 'https://neosoft-updates.s3.amazonaws.com/zupdate/NHomeServer/' + serverStatus.version + '.xml';
        $http.get(url)
          .success(function(data, status) {
            var updates = $(data).find('update').length;
            if (updates) {
              server.upToDate = false;
            } else {
              server.upToDate = true;
            }
          })
          .error(function(data, status) {
            $rootScope.$broadcast('checkFailed');
          });
        setTimeout(function() {
          getGoogleMap({
            lat: parseFloat(server.serverInfoData.latitude),
            lng: parseFloat(server.serverInfoData.longitude)
          });
        }, 250);
      });
      /* download server configuration, backup */
      socket.emit('configBackup', null, function(config) {
        var data = JSON.stringify(config);
        var backup = document.getElementById('download-backup');
        backup.setAttribute('href', 'data:application/json;charset=utf8,' + encodeURIComponent(data));
      });

      /* update app, if possible */
      server.updateApp = function() {
        socket.emit('updateApp');
      };
      // set max file size for recordings
      server.setRecordingsLimit = function(){
        var maxSize = document.getElementsByName('record-folder-size')[0];
        console.log(Number(maxSize.value));
        socket.emit3('configSet', 'recordingQuota', Number(maxSize.value), function(response){
          if(response){
            maxSize.classList.add('success');
            $timeout(function(){
              maxSize.classList.remove('success');
            },1500);
          }
        })
      }
      /* change server name */
      server.changeServerName = function(newName) {
        socket.emit('configSet', 'name', newName);
        $rootScope.$broadcast('newServerName', newName);
      };
      /* restore server configuration */
      $scope.restore = function(elem) {

        var backupRestore = elem;
        var reader = new FileReader();
        reader.addEventListener('loadend', function() {
          var config;
          try {
            config = JSON.parse(reader.result);
          } catch (e) {
            console.log(e);
            alert('Failed to read config data');
            return false;
          }
          socket.emit('configRestore', config, function() {
            alert('Config restored, please restart your server');
          });
        });
        reader.readAsText(backupRestore.files[0]);
      };

      /* bridge rename */
      server.leaveServer = function() {
        socket.emit('permServerRemoveSelf', null, function(response) {
          console.log(response);
          if (response) {
            redirectUser();
          }
        });
      };

      /*  delete server */
      server.deleteServer = function() {
        server.deleteServerCount += 1;
        if (server.deleteServerCount === 2) {
          socket.emit('deleteServer', null, function(response) {
            /* redirect */
            if (response) {
              // remove deleted server from active user server list
              var activeServer = JSON.parse(sessionStorage.activeServer);
              var userInfo = JSON.parse(sessionStorage.userInfoData);
              angular.forEach(userInfo.servers, function(server, index){
                if(server.id === activeServer.id){
                  userInfo.servers.splice(index, 1);
                }
              });
              sessionStorage.userInfoData = JSON.stringify(userInfo);
              redirectUser();
            }
          });
        } else {
          server.ownerPermissions = true;
          return;
        }
      };

      /* google maps */
      server.useIpAddress = function() {
        $scope.$broadcast('useIP');
      };

      function getGoogleMap(coordinates) {
        $scope.$broadcast('getGoogleMap', coordinates);
      };

      /* USERS SETTINGS */
      /* user setings, invite, delete, change level */
      server.inviteUser = function() {
        var inviteEmail = document.getElementById('invite-email').value;
        var inviteMsg = document.getElementById('invite-msg').value;
        var inviteStatus = document.getElementById('invite-status').value;

        console.log(inviteMsg, inviteStatus);

        socket.emit4('inviteUser', inviteEmail, inviteMsg, inviteStatus, function(invite) {
          console.log(invite);
          if (invite) {
            server.inviteSuccess = true;
            $timeout(function() {
              server.inviteSuccess = false;
            }, 1000);
            server.data.userList.push({
              email: inviteEmail,
              level: inviteStatus,
            })
          } else {
            alert('Inviting ' + inviteEmail + ' failed!');
          }
        });
      };

      server.changeUserLevel = function(email, level, index) {
        if (level === 'DELETE') {
          deleteUser(email, index);
          if (email === server.data.getUserProfile.email) {
            redirectUser();
          }
        } else if (level === 'OWNER') {
          socket.emit('permServerChangeOwner', email, function(response) {
            console.log(response);
            if (response) {
              server.data.getUserProfile.level = 'ADMIN';
              angular.forEach(server.data.userList, function(user){
                if(user.email === server.data.getUserProfile.email){
                  user.level === 'ADMIN';
                  return
                }
              });
            }
          });
        } else {
          console.log(email, level);
          socket.emit('permServerSetLevel', email, level, function(data) {
            console.log(data);
          });
        }
      };

      function deleteUser(email, index) {
        socket.emit('permServerRemove', email, function(removeUser) {
          if (removeUser) {
            server.data.userList.splice(index, 1);
          }
        });
      };
      // redirect user to another server
      function redirectUser() {
        socket.emit('getServers', null, function(servers) {
          if (!servers.length) {
            $state.go('login');
            sessionStorage.removeItem('activeServer');
            sessionStorage.removeItem('userInfoData');
            sessionStorage.removeItem('gravatar');
            dataRequest.logout()
              .then(function(reponse) {
                location.reload();
              });
          } else {
            sessionStorage.activeServer = JSON.stringify(servers[0]);
            location.reload(true);
          }
        });
      }
      server.testRegex = function(str, re) {
        var regex = new RegExp(re);
        return regex.test(str);
      };
      server.loadMoreLog = function() {
        activityLogDay += 1;
        socket.emit('getActionLog', activityLogDay, function(log) {
          server.actionLog = log.reverse();
        });
        // server.actionLog = server.actionLog.concat(server.bigData.getActionLog.slice(server.actionLog.length, server.actionLog.length + 50));
      };

      server.data = dataService.getData();
      server.bigData = dataService.getBigData();
      server.actionLog = server.bigData.getActionLog ? server.bigData.getActionLog : [];

      if (!server.data.getUserProfile || !server.data.getBridges || !server.data.userList) {
        dataService.getServerEmits().then(function(actionLog) {
          server.data = dataService.getData();
          server.bigData = dataService.getBigData();
          server.actionLog = actionLog;
        })
        dataService.getDevicesEmit();
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
      }
    }]);
}());
