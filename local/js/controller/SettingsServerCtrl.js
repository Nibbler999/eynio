(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('SettingsServerCtrl', ['$scope', '$rootScope', '$timeout', '$state', 'socket', 'dataService', 'dataRequest', function($scope, $rootScope, $timeout, $state, socket, dataService, dataRequest) {

      var server = this;
      var activityLogDay = 1;
      server.deleteServerCount = 0;
      server.upToDate = true;
      var restoreServer = document.querySelector('#restore-server');

      // get server data and check for updates
      socket.emit('getServerStatus', null, function(serverStatus) {
        console.log(serverStatus);
        server.serverInfoData = serverStatus;
        $timeout(function() {
          getGoogleMap({
            lat: parseFloat(server.serverInfoData.latitude),
            lng: parseFloat(server.serverInfoData.longitude)
          });
        }, 250);
      });
      // check for updates
      socket.emit('checkUpdates', null, function(response) {
          server.upToDate = !response;
        })
        // configure backup withlatest data
      socket.emit('configBackup', null, function(config) {
        var data = JSON.stringify(config);
        var backup = document.getElementById('download-backup');
        backup.setAttribute('href', 'data:application/json;charset=utf8,' + encodeURIComponent(data));
      });

      /**
       * @name updateApp
       * @desc send emit to update app
       * @type {function}
       */
      server.updateApp = function() {
        socket.emit('updateApp');
      };
      /**
       * @name setRecordingsLimit
       * @desc set camera recordings folder size
       * @type {function}
       * @param {maxSize} size in MB
       */
      server.setRecordingsLimit = function(maxSize) {
        socket.emit3('configSet', 'recordingQuota', Number(maxSize), function(response) {
          if (response) {
            server.setRecordingsLimitSuccess = true;
            $timeout(function() {
              server.setRecordingsLimitSuccess = false;
            }, 1500);
          }
        })
      };
      /**
       * @name changeServerName
       * @desc change server name
       * @type {function}
       * @param {newName}
       */
      server.changeServerName = function(newName) {
        socket.emit('configSet', 'name', newName);
        $rootScope.$broadcast('newServerName', newName);
      };
      /**
       * @name restore
       * @desc restore server backup
       * @type {function} $scope fn, onchange event
       * @param {elem} input element
       */
      restoreServer.addEventListener('change', function(e) {
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
        reader.readAsText(this.files[0]);
      });
      /**
       * @name leaveServer
       * @desc leave current serrver
       * @type {function}
       */
      server.leaveServer = function() {
        socket.emit('permServerRemoveSelf', null, function(response) {
          if (response) {
            redirectUser();
          }
        });
      };
      /**
       * @name deleteServer
       * @desc delete current server if level  == 'OWNER'
       * @type {function}
       */
      server.deleteServer = function() {
        server.deleteServerCount += 1;
        if (server.deleteServerCount === 2) {
          socket.emit('deleteServer', null, function(response) {
            /* redirect */
            if (response) {
              // remove deleted server from active user server list
              var activeServer = JSON.parse(sessionStorage.activeServer);
              var userInfo = JSON.parse(sessionStorage.userInfoData);
              angular.forEach(userInfo.servers, function(server, index) {
                if (server.id === activeServer.id) {
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
      /**
       * @name useIpAddress
       * @desc use IP address for server location and google maps
       * @type {function}
       */
      server.useIpAddress = function() {
        $scope.$broadcast('useIP');
      };
      /**
       * @name getGoogleMap
       * @desc initialise google maps
       * @type {function}
       * @param {coordinates} server coordinates
       */
      function getGoogleMap(coordinates) {
        $scope.$broadcast('getGoogleMap', coordinates);
      };
      /**
       * @name inviteUser
       * @desc invite new user to server
       * @type {function}
       * @param {email, msg, status} new email, ivite message, status
       */
      server.inviteUser = function(email, msg, status) {
        socket.emit4('inviteUser', email, msg, status, function(response) {
          if (response) {
            server.inviteSuccess = true;
            $timeout(function() {
              server.inviteSuccess = false;
            }, 1000);
            server.data.userList.push({
              email: email,
              level: status,
            });
          } else {
            alert('Inviting ' + email + ' failed!');
          }
        });
      };
      /**
       * @name changeUserLevel
       * @desc change user level or delete user
       * @type {function}
       * @param {email, level, index} user email, new level, index in array
       */
      server.changeUserLevel = function(email, level, index) {
        if (level === 'DELETE') {
          deleteUser(email, index);
          if (email === server.data.getUserProfile.email) {
            redirectUser();
          }
        } else if (level === 'OWNER') {
          socket.emit('permServerChangeOwner', email, function(response) {
            if (response) {
              server.data.getUserProfile.level = 'ADMIN';
              angular.forEach(server.data.userList, function(user) {
                if (user.email === server.data.getUserProfile.email) {
                  user.level === 'ADMIN';
                }
              });
            }
          });
        } else {
          socket.emit('permServerSetLevel', email, level);
        }
      };
      /**
       * @name testRegex
       * @desc test string to find specific word
       * @type {function}
       * @param {str, re} word to search, whole string
       */
      server.testRegex = function(str, re) {
        var regex = new RegExp(re);
        return regex.test(str);
      };
      /**
       * @name loadMoreLog
       * @desc load logs from +1 day
       * @type {function}
       */
      server.loadMoreLog = function() {
        activityLogDay += 1;
        socket.emit('getActionLog', activityLogDay, function(log) {
          server.actionLog = server.actionLog.concat(log.reverse());
        });
        // server.actionLog = server.actionLog.concat(server.bigData.getActionLog.slice(server.actionLog.length, server.actionLog.length + 50));
      };
      /**
       * @name deleteUser
       * @desc delete current user
       * @type {function}
       * @param {email, index} email to delete, index in array
       */
      function deleteUser(email, index) {
        socket.emit('permServerRemove', email, function(removeUser) {
          if (removeUser) {
            server.data.userList.splice(index, 1);
          }
        });
      };
      /**
       * @name redirectUser
       * @desc redirect usaer to new server or login if no servers found
       * @type {function}
       */
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

      // ged data
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
