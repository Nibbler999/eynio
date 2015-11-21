(function() {
  "use strict";

  angular
    .module('services')
    .service('dataService', ['$q', '$rootScope', 'socket', function($q, $rootScope, socket) {

      // data
      var allDev, allRemotes, allScenes, allCategories, allCustomRemotes;

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

      this.socketConnect = function(token, serverId) {
        var deferred = $q.defer();
        socket.connect(token, serverId);
        deferred.resolve();
        return deferred.promise;
      };

      this.dataPending = function() {
        var deferred = $q.defer();

        socket.emit('getDevices', null, function(data) {
          console.log(data);
          localStorage.devices = JSON.stringify(data);

          for (var i = 0; i < data.length; i++) {
            data[i].count = i;
            data[i].scene_select = false;
            data[i].schedule_select = false;
          }

          allDev = data;
          sortDevicesByType(data);
          deferred.resolve();
        });
        socket.emit('getCustomRemotes', null, function(customRemotes) {
          console.log(customRemotes);
          if (customRemotes) {
            for (var i = 0; i < customRemotes.length; i++) {
              customRemotes[i].count = i;
              if (customRemotes[i].type.toLowerCase() === 'tv') {
                allTVcustomRemotes.push(customRemotes[i]);
              } else if (customRemotes[i].type.toLowerCase() === 'ac') {
                allACcutomRemotes.push(customRemotes[i]);
              } else if (customRemotes[i].type.toLowerCase() === 'multi') {
                allMEDIAcustomRemotes.push(customRemotes[i]);
              }
              allCustomRemotes = customRemotes;
            }
          }
        });
        socket.emit('getRemotes', null, function(remotes) {
          allRemotes = remotes;
        });
        /* get scenes from server */
        socket.emit('getScenes', null, function(scenes) {
          allScenes = scenes;
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
          newRemote.count = allCustomRemotes.length;
          allCustomRemotes.push(newRemote);
        });
        socket.on('customRemoteDeleted', function(delRemote) {
          angular.forEach(allCustomRemotes, function(rem) {
            if (rem.id === delRemote) {
              allCustomRemotes.splice(allCustomRemotes.indexOf(rem), 1);
            }
          });
        });
        socket.on('customRemoteUpdated', function(updateRemote) {
          angular.forEach(allCustomRemotes, function(remote) {
            if (remote.id === updateRemote.id) {
              remote = updateRemote;
            };
          });
        });
        socket.on('deviceRenamed', function(devRenamed) {
          console.log(devRenamed);
        });
        /*  scene deleted */
        socket.on('sceneDeleted', function(deletedScene) {
          angular.forEach(allScenes, function(scene) {
            if (scene.id === deletedScene) {
              allScenes.splice(allScenes.indexOf(scene), 1);
            }
          });
        });

        serverSettingsData();
      };
      var activeUser, bridges, userList, serverLog;

      var serverSettingsData = function() {

        /* get bridges */
        socket.emit('getBridges', null, function(bridge) {
          bridges = bridge;
        });
        /* get server log */
        socket.emit('log', null, function(log) {
          serverLog = log;
        });
      };

      var sortDevicesByType = function(allDev) {
        angular.forEach(allDev, function(dev) {
          if (dev.type === 'switch') {
            allSwitches.push(dev);
          } else if (dev.type === 'light') {
            allLights.push(dev);
          } else if (dev.type === 'thermostat') {
            allThermos.push(dev);
          } else if (dev.type === 'shutter') {
            allShutters.push(dev);
          } else if (dev.type === 'sensor') {
            allSensors.push(dev);
          } else if (dev.type === 'camera') {
            allCameras.push(dev);
          }
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
      this.customRemotes = function() {
        return allCustomRemotes;
      };
      this.TVcustomRemotes = function() {
        return allTVcustomRemotes;
      };
      this.ACcustomRemotes = function() {
        return allACcutomRemotes;
      };
      this.MEDIAcustomRemotes = function() {
        return allMEDIAcustomRemotes;
      };
      this.remotes = function() {
        return allRemotes;
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
      this.serverLog = function() {
        return serverLog;
      };
      /* categories stuff */
      this.categories = function() {
        return allCategories;
      };
      /* return scenes */
      this.scenes = function() {
        return allScenes;
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
