(function() {
  "use strict";

  angular
    .module('services')
    .service('dataService', ['$q', '$rootScope', 'socket', function($q, $rootScope, socket) {

      // data
      var allDev, allBlacklistedDev, allBridges, allScenes, allCategories, allRemotes, actionLog;

      var activeUser, bridges, userList;

      var allSwitches = [];
      var allLights = [];
      var allThermos = [];
      var allShutters = [];
      var allSensors = [];
      var allCameras = [];
      var allScenes = [];

      var allTVcustomRemotes = [];
      var allACcutomRemotes = [];
      var allMEDIAcustomRemotes = [];

      // connect to socket via net
      this.socketConnect = function(token, serverId) {
        var deferred = $q.defer();
        socket.connect(token, serverId);
        deferred.resolve();
        return deferred.promise;
      };
      // connect to socket localy
      this.localSocketConnect = function(ip) {
        var deferred = $q.defer();
        socket.connectLocal(ip);
        deferred.resolve();
        return deferred.promise;
      };

      // get data form socket
      this.dataPending = function() {
        var deferred = $q.defer();

        // get reotes
        socket.emit('getCustomRemotes', null, function(customRemotes) {
          allRemotes = customRemotes;
        });
        socket.emit('getCategories', null, function(categories) {
          allCategories = categories;
        });
        // get all devices
        socket.emit('getDevices', null, function(data) {
          console.log(data);
          //localStorage.devices = JSON.stringify(data);
          // for (var i = 0; i < data.length; i++) {
          //   data[i].count = i;
          //   data[i].scene_select = false;
          //   data[i].schedule_select = false;
          // }

          allDev = data;
          deferred.resolve(data);
        });
        // get blacklist devices
        socket.emit('getBlacklist', 'devices', function(blacklistedDev){
          allBlacklistedDev = blacklistedDev;
        });
        // get bridges
        socket.emit('getRemotes', null, function(bridges) {
          allBridges = bridges;
        });
        /* get scenes from server */
        socket.emit('getScenes', null, function(scenes) {
          allScenes = scenes;
        });
        /* get activity log, listen for updates */
        socket.emit('getActionLog', null, function(log) {
          actionLog = log.reverse();
        });
        socketListeners();
        return deferred.promise;
      };

      var socketListeners = function() {

        socket.on('cameraAdded', function(newCam) {
          console.log(newCam);
          allCameras.push(newCam);
        });
        socket.on('cameraDeleted', function(deletedCamId) {
          angular.forEach(allCameras, function(cam) {
            if (cam.id === deletedCamId) {
              allCameras.splice(allCameras.indexOf(cam), 1);
            }
          });
        });
        socket.on('customRemoteAdded', function(newRemote) {
          console.log(newRemote);
          newRemote.count = allRemotes.length;
          allRemotes.push(newRemote);
        });
        socket.on('customRemoteDeleted', function(delRemote) {
          angular.forEach(allRemotes, function(rem) {
            if (rem.id === delRemote) {
              allRemotes.splice(allRemotes.indexOf(rem), 1);
            }
          });
        });
        socket.on('customRemoteUpdated', function(updateRemote) {
          angular.forEach(allRemotes, function(remote) {
            if (remote.id === updateRemote.id) {
              remote = updateRemote;
            };
          });
        });
        socket.on('deviceRenamed', function(devId, devName) {
          angular.forEach(allDev, function(dev) {
            if (dev.id === devId) {
              dev.name = devName;
            }
          });
        });
        /*  scene deleted */
        socket.on('sceneDeleted', function(deletedScene) {
          angular.forEach(allScenes, function(scene) {
            if (scene.id === deletedScene) {
              allScenes.splice(allScenes.indexOf(scene), 1);
            }
          });
        });

        socket.on('deviceBlacklisted', function(devType, devId) {
          console.log(devType, devId);
          angular.forEach(allDev, function(dev) {
            if (dev.id === devId) {
              allDev.splice(allDev.indexOf(dev), 1);
            }
          });
        });

        socket.on('deviceUnblacklisted', function(devType, devId) {
          console.log(devType, devId);
        });

        serverSettingsData();
      };

      var serverSettingsData = function() {

        /* get uset profile, LEVEL */
        socket.emit('getUserProfile', null, function(user) {
          console.log(user);
          activeUser = user;
        });
        /* get bridges */
        socket.emit('getBridges', null, function(bridge) {
          bridges = bridge;
        });
        /* get full list of users */
        socket.emit('permServerGet', null, function(allUsers) {
          userList = allUsers;
        });
      };

      /* return devices */
      this.allDev = function() {
        return allDev;
      };
      this.switches = function() {
        return allSwitches;
      };
      this.lights = function() {
        return allLights;
      };
      this.thermostats = function() {
        return allThermos;
      };
      this.shutters = function() {
        return allShutters;
      };
      this.sensors = function() {
        console.log(allSensors);
        return allSensors;
      };
      this.cameras = function() {
        return allCameras;
      };
      this.allCustomRemotes = function() {
        return allRemotes;
      };
      this.bridges = function() {
        return allBridges;
      };
      this.scenes = function() {
        return allScenes;
      };

      /* server status */
      this.user = function() {
        return activeUser
      };
      this.bridge = function() {
        return bridges;
      };
      this.userList = function() {
        return userList;
      };
      /* categories stuff */
      this.categories = function() {
        return allCategories;
      };

      this.getActionLog = function() {
          return actionLog;
        }
        /* return scenes */
      this.scenes = function() {
        return allScenes;
      };

      // helper functions
      this.sortDevicesByType = function(devArr, type) {
        var arr = [];
        angular.forEach(devArr, function(dev) {
          if (dev.type === type) {
            arr.push(dev);
          }
        });
        return arr;
      };

      this.sortRemotesByType = function(remotesArr, type) {
        var arr = [];
        angular.forEach(remotesArr, function(remote) {
          if (remote.type === type) {
            arr.push(remote);
          }
        });
        return arr;
      };

      this.getBlacklistDevices = function(devArr){
        var arr = [];

        angular.forEach(devArr, function(dev){
          if(dev.blacklisted){
            arr.push(dev);
          }
        });
        return arr;
      };

      this.blobToImage = function(imageData) {
        if (Blob && 'undefined' != typeof URL) {
          var blob = new Blob([imageData], {
            type: 'image/jpeg'
          });
          return URL.createObjectURL(blob);
        } else if (imageData.base64) {
          return 'data:image/jpeg;base64,' + imageData.data;
        } else {
          return 'about:blank';
        }
      };

      this.fullScreen = function(element) {
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
          element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          element.msRequestFullscreen();
        }
      };
    }]);
}());
