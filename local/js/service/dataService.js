(function() {
  "use strict";

  angular
    .module('services')
    .service('dataService', ['$q', '$rootScope', 'socket', function($q, $rootScope, socket) {

      var currentServerData = {};

      var IDBServerData, IDBUserData, IDBUser, IDBServerId;

      // try to open IDB and get user and last data
      openDB('last_user', 1, 'last');

      // connect to socket via net
      this.socketConnect = function() {
        var deferred = $q.defer();
        socket.connect();
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

      this.getCategoriesEmit = function() {
        var deferred = $q.defer();
        socket.emit('getCategories', null, function(categories) {
          deferred.resolve(categories);
          currentServerData.getCategories = categories;
          //allCategories = categories;
          putDB(IDBServerData, IDBServerId, 'getCategories', categories);
        });
        return deferred.promise
      };

      this.getDevicesEmit = function() {
        var deferred = $q.defer();

        socket.emit('getDevices', null, function(data) {
          currentServerData.getDevicesArray = data;
          //allDevArray = data;
          currentServerData.getDevicesObj = {};
          currentServerData.getBlacklisted = [];

          angular.forEach(data, function(dev, index) {
            dev.count = index;
            currentServerData.getDevicesObj[dev.type] = currentServerData.getDevicesObj[dev.type] || [];
            if (!dev.blacklisted) {
              currentServerData.getDevicesObj[dev.type].push(dev);
            } else {
              currentServerData.getBlacklisted.push(dev);
            }
          });

          console.log(currentServerData.getDevicesObj, currentServerData.getBlacklisted);
          deferred.resolve(currentServerData.getDevicesObj);
          putDB(IDBServerData, IDBServerId, 'getDevices', currentServerData.getDevicesObj);
        });
        return deferred.promise
      };

      this.getScenesEmit = function() {
        var deferred = $q.defer();
        socket.emit('getScenes', null, function(scenes) {
          deferred.resolve(scenes);
          currentServerData.getScenes = scenes;
          putDB(IDBServerData, IDBServerId, 'getScenes', scenes);
        });
        return deferred.promise
      };

      this.getSchedulesEmit = function() {
        var deferred = $q.defer();
        socket.emit('getJobs', null, function(schedules) {
          deferred.resolve(schedules);
          currentServerData.getSchedules = schedules;
          putDB(IDBServerData, IDBServerId, 'getSchedules', schedules);
        });
        return deferred.promise
      };

      this.getRecordingsEmit = function() {
        var deferred = $q.defer();
        socket.emit('getRecordings', null, function(recordings) {
          deferred.resolve(recordings);
          currentServerData.getRecordings = recordings;
          putDB(IDBServerData, IDBServerId, 'getRecordings', recordings);
          console.log(recordings);
        });
        return deferred.promise
      };

      this.setAllListeners = function() {

        /* listen for server log updates */
        socket.on('log', function(newLog) {
          currentServerData.getLog.unshift(newLog)
        });
        socket.on('jobAdded', function(scheduleObj) {
          currentServerData.getSchedules.push(scheduleObj);
          window.navigator.vibrate(250);
        });
        socket.on('customRemoteAdded', function(remoteObj) {
          currentServerData.getDevicesObj.remote.push(remoteObj);
          window.navigator.vibrate(250);
        });
        socket.on('sceneAdded', function(sceneObj) {
          currentServerData.getScenes.push(sceneObj);
          window.navigator.vibrate(250);
        });
        socket.on('cameraAdded', function(cameraObj) {
          console.log(cameraObj);
          currentServerData.getDevicesObj.camera.push(cameraObj);
          window.navigator.vibrate(250);
        });
        socket.on('cameraDeleted', function(deletedCamId) {
          angular.forEach(currentServerData.getDevicesObj.camera, function(cam, index) {
            if (cam.id === deletedCamId) {
              currentServerData.getDevicesObj.camera.splice(index, 1);
              window.navigator.vibrate(50);
            }
          });
        });
        socket.on('customRemoteDeleted', function(remoteID) {
          angular.forEach(currentServerData.getDevicesObj.remote, function(rem, index) {
            if (rem.id === remoteID) {
              currentServerData.getDevicesObj.remote.splice(index, 1);
              window.navigator.vibrate(50);
            }
          });
        });
        socket.on('sceneDeleted', function(sceneId) {
          angular.forEach(currentServerData.getScenes, function(scene, index) {
            if (scene.id === sceneId) {
              currentServerData.getScenes.splice(index, 1);
              window.navigator.vibrate(50);
            }
          });
        });
        socket.on('jobRemoved', function(scheduleId) {
          angular.forEach(currentServerData.getSchedules, function(schedule, index) {
            if (schedule.id === scheduleId) {
              currentServerData.getSchedules.splice(index, 1);
              window.navigator.vibrate(50);
            }
          });
        });
        socket.on('customRemoteUpdated', function(updateRemote) {
          angular.forEach(currentServerData.getDevicesObj.remote, function(remote) {
            if (remote.id === updateRemote.id) {
              remote = updateRemote;
              window.navigator.vibrate(150);
            };
          });
        });
        socket.on('deviceRenamed', function(devId, devName) {
          angular.forEach(currentServerData.getDevicesObj, function(typeArray) {
            angular.forEach(typeArray, function(dev) {
              if (dev.id === devId) {
                dev.name = devName;
                window.navigator.vibrate(150);
              }
            })
          });
          /* for most used and recently */
          angular.forEach(currentServerData.getDevicesArray, function(dev) {
            if (dev.id === devId) {
              dev.name = devName;
            }
          });
        });
        socket.on('deviceBlacklisted', function(devType, devId) {
          angular.forEach(currentServerData.getDevicesObj, function(typeArray) {
            angular.forEach(typeArray, function(dev, index) {
              if (dev.id === devId) {
                typeArray.splice(index, 1);
                currentServerData.getBlacklisted.push(dev);
                window.navigator.vibrate(75);
              }
            })
          });
        });
        socket.on('deviceUnblacklisted', function(devType, devId) {
          angular.forEach(currentServerData.getBlacklisted, function(dev, index) {
            if (dev.id === devId) {
              currentServerData.getBlacklisted.splice(index, 1);
              currentServerData.getDevicesObj[dev.type].push(dev);
              window.navigator.vibrate(150);
            }
          });
        });
        socket.on('sensorValue', function(sensorChange) {

          angular.forEach(currentServerData.getDevicesObj.sensor, function(sensor) {
            if (sensor.id === sensorChange.id) {
              sensor.value = sensorChange.value;
            }
          });
        });
      };

      this.getServerEmits = function() {
        var deferred = $q.defer();

        /* get uset profile, LEVEL */
        socket.emit('getUserProfile', null, function(user) {
          currentServerData.getUserProfile = user;
          console.log(user);
        });
        /* get bridges */
        socket.emit('getBridges', null, function(bridges) {
          currentServerData.getBridges = bridges || [];
        });
        // get remote bridges
        socket.emit('getRemotes', null, function(remoteBridges) {
          currentServerData.getRemotes = remoteBridges;
          currentServerData.getBridges = currentServerData.getBridges.concat(remoteBridges);
        });
        /* get full list of users */
        socket.emit('permServerGet', null, function(allUsers) {
          currentServerData.userList = allUsers;
        });
        /* get activity log, listen for updates */
        socket.emit('getActionLog', null, function(log) {
          currentServerData.getActionLog = log.reverse();
          deferred.resolve(log);
        });
        /* get server log */
        socket.emit('getLog', null, function(log) {
          currentServerData.getLog = log.reverse();
        });
        socket.emit('getApiKey', null, function(key) {

        });
        //get list of server for user
        socket.emit('getServers', null, function(servers) {
          currentServerData.getServers = servers;
        });
        // get weather from yrno
        socket.emit('getWeather', null, function(weatherInfo) {
          currentServerData.getWeather = weatherInfo;
        });
        //get alarm status
        socket.emit('isAlarmEnabled', null, function(alarmState) {
          currentServerData.isAlarmEnabled = alarmState;
        });

        return deferred.promise
      };

      this.logOut = function() {
        currentServerData = {};
      };
      /* return devices */
      this.getData = function() {
        return currentServerData;
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

      // function sendMessage(message) {
      //   // This wraps the message posting/response in a promise, which will resolve if the response doesn't
      //   // contain an error, and reject with the error if it does. If you'd prefer, it's possible to call
      //   // controller.postMessage() and set up the onmessage handler independently of a promise, but this is
      //   // a convenient wrapper.
      //   return new Promise(function(resolve, reject) {
      //     var messageChannel = new MessageChannel();
      //     messageChannel.port1.onmessage = function(event) {
      //       if (event.data.error) {
      //         reject(event.data.error);
      //       } else {
      //         resolve(event.data);
      //       }
      //     };
      //
      //     // This sends the message data as well as transferring messageChannel.port2 to the service worker.
      //     // The service worker can then use the transferred port to reply via postMessage(), which
      //     // will in turn trigger the onmessage handler on messageChannel.port1.
      //     // See https://html.spec.whatwg.org/multipage/workers.html#dom-worker-postmessage
      //     navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
      //   });
      // }

      function openDB(db, dbV, objStore) {

      };

      function putDB(idb, objStore, objStoreKey, data) {

      };

      function getDB(idb, objStore, objStoreKey) {

      };
    }]);
}());
