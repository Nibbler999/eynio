(function() {
  "use strict";

  angular
    .module('services')
    .service('dataService', ['$q', 'socket', function($q, socket) {

      var currentServerData = {};
      var bigServerData = {};
      var accountData = {};

      var IDBServerData, IDBUserData, IDBUser, IDBServerId;

      var fromLogin = sessionStorage.userInfoData ? false : true;

      // try to open IDB and get user and last data
      openDB('last_user', 1, 'last');

      // connect to socket via net
      this.socketConnect = function(user, server) {
        console.log(user, server);
        var deferred = $q.defer();

        user.lastServer = server;
        currentServerData.user = user;
        if (!IDBUser) {
          IDBUser = user;
          if (fromLogin && !IDBServerData) {
            IDBUser.IDBVersion = 1;
            openDB('users', IDBUser.IDBVersion, IDBUser.email);
          }
        } else {
          user.IDBVersion = IDBUser.IDBVersion;
          if (IDBUser.email !== user.email || IDBUser.lastServer.id !== user.lastServer.id) {
            IDBServerData.close();
            currentServerData = {};
            IDBUser = user;
            if (IDBServerData.objectStoreNames.contains(IDBUser.email)) {
              openDB('users', IDBUser.IDBVersion, user.email);
            } else {
              IDBUser.IDBVersion += 1;
              openDB('users', IDBUser.IDBVersion, user.email);
            }
          } else {
            IDBUser = user;
          }
        }
        socket.connect(encodeURIComponent(user.token), server.id);
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
          putDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id, currentServerData);
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
          deferred.resolve(currentServerData.getDevicesObj);
          putDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id, currentServerData);
        });
        return deferred.promise
      };

      this.getScenesEmit = function() {
        var deferred = $q.defer();
        socket.emit('getScenes', null, function(scenes) {
          deferred.resolve(scenes);
          currentServerData.getScenes = scenes;
          putDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id, currentServerData);
        });
        return deferred.promise
      };

      this.getSchedulesEmit = function() {
        var deferred = $q.defer();
        socket.emit('getJobs', null, function(schedules) {
          deferred.resolve(schedules);
          currentServerData.getSchedules = schedules;
          putDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id, currentServerData);
        });
        return deferred.promise
      };

      this.getRecordingsEmit = function() {
        var deferred = $q.defer();
        socket.emit('getRecordings', null, function(recordings) {
          console.log(recordings.length);
          deferred.resolve(recordings);
          bigServerData.getRecordings = recordings.reverse();
          // putDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id, currentServerData);

          // check for unfinished recordings
          // angular.forEach(currentServerData.getRecordings, function(rec) {
          //   if (!rec.endtime) {
          //     angular.forEach(currentServerData.getDevicesObj.camera, function(cam) {
          //       if (cam.id === rec.cameraid) {
          //         cam.recordingId = rec.id;
          //       }
          //     })
          //   }
          // });
          // putDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id, currentServerData);
        });
        return deferred.promise
      };

      this.setAllListeners = function() {

        /* listen for server log updates */
        socket.on('log', function(newLog) {
          bigServerData.getLog.unshift(newLog)
        });
        socket.on('jobAdded', function(scheduleObj) {
          currentServerData.getSchedules.push(scheduleObj);
          window.navigator.vibrate(250);
        });
        socket.on('customRemoteAdded', function(remoteObj) {
          console.log(remoteObj);
          if (currentServerData.getDevicesObj.remote) {
            currentServerData.getDevicesObj.remote.push(remoteObj);
          } else {
            currentServerData.getDevicesObj.remote = [];
            currentServerData.getDevicesObj.remote.push(remoteObj);
          }
          currentServerData.getDevicesArray.push(remoteObj);
          window.navigator.vibrate(250);
        });
        socket.on('sceneAdded', function(sceneObj) {
          currentServerData.getScenes.push(sceneObj);
          window.navigator.vibrate(250);
        });
        socket.on('cameraAdded', function(cameraObj) {
          if (currentServerData.getDevicesObj.camera) {
            currentServerData.getDevicesObj.camera.push(cameraObj);
          } else {
            currentServerData.getDevicesObj.camera = [];
            currentServerData.getDevicesObj.camera.push(cameraObj);
          }
          currentServerData.getDevicesArray.push(cameraObj);
          window.navigator.vibrate(250);
        });
        socket.on('recordingAdded', function(recObj) {
          bigServerData.getRecordings.unshift(recObj);

          // check for unfinished recordings
          // if (!recObj.endtime) {
          //   angular.forEach(currentServerData.getDevicesObj.camera, function(cam) {
          //     if (cam.id === recObj.cameraid) {
          //       cam.recordingId = recObj.id;
          //       putDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id, currentServerData);
          //     }
          //   })
          // }
        });
        socket.on('recordingDeleted', function(recId) {
          angular.forEach(bigServerData.getRecordings, function(rec, index) {
            if (rec.id === recId) {
              bigServerData.getRecordings.splice(index, 1);
            }
          })
        });
        socket.on('cameraDeleted', function(deletedCamId) {
          angular.forEach(currentServerData.getDevicesObj.camera, function(cam, index) {
            if (cam.id === deletedCamId) {
              currentServerData.getDevicesObj.camera.splice(index, 1);
              window.navigator.vibrate(50);
            }
          });
          angular.forEach(currentServerData.getDevicesArray, function(dev, index) {
            if (dev.id === deletedCamId) {
              currentServerData.getDevicesArray.splice(index, 1);
            }
          });
        });
        socket.on('cameraUpdated', function(camUpdate) {
          angular.forEach(currentServerData.getDevicesObj.camera, function(cam) {
            if (cam.id === camUpdate.id) {
              cam = camUpdate;
            }
          })
        });
        socket.on('customRemoteDeleted', function(remoteID) {
          angular.forEach(currentServerData.getDevicesObj.remote, function(rem, index) {
            if (rem.id === remoteID) {
              currentServerData.getDevicesObj.remote.splice(index, 1);
              window.navigator.vibrate(50);
            }
          });
          angular.forEach(currentServerData.getDevicesArray, function(dev, index) {
            if (dev.id === remoteID) {
              currentServerData.getDevicesArray.splice(index, 1);
            }
          })
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
                dev.blacklisted = true;
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
              dev.blacklisted = false;
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
        socket.emit('getActionLog', 1, function(log) {
          bigServerData.getActionLog = log.reverse();
          deferred.resolve(log);
        });
        /* get server log */
        socket.emit('getLog', null, function(log) {
          bigServerData.getLog = log.reverse();
        });
        socket.emit('getApiKey', null, function(key) {
          currentServerData.getApiKey = key;
          // apiKey = key;
          IDBUser.apiKey = key;
          putDB(IDBUserData, 'last', 'user', IDBUser);
        });
        //get list of server for user
        socket.emit('getServers', null, function(servers) {
          currentServerData.getServers = servers;
          angular.forEach(currentServerData.user.servers, function(userServer) {
            angular.forEach(servers, function(server) {
              if (userServer.id === server.id) {
                userServer.online = server.online;
              }
            });
          });
        });
        // get weather from yrno
        socket.emit('getWeather', null, function(weatherInfo) {
          currentServerData.getWeather = weatherInfo;
        });
        //get alarm status
        socket.emit('isAlarmEnabled', null, function(alarmState) {
          currentServerData.isAlarmEnabled = alarmState;
        });
        socket.emit('getAlarmConfig', null, function(alarmConf) {
          currentServerData.getAlarmConfig = alarmConf;
        });

        return deferred.promise
      };

      /**
       * @name getAccountEmit
       * @desc get account state data
       * @type {function}
       */
      this.getAccountEmit = function() {
        var defer = $q.defer();
        // get user data
        socket.emit('getUserProfile', null, function(response) {

          accountData.getUserProfile = response;
          // console.log(userProfile);
          // acc.userProfile = userProfile;
          // document.querySelector('.settings-user-avatar').style.backgroundImage = 'url(' + userProfile.avatar + ')';
        });
        // offline notifications
        socket.emit('getOfflineNotifications', null, function(response) {
          accountData.getOfflineNotifications = response;
          // acc.offlineNotifications = data;
        });
        // alarm notifications
        socket.emit('getAlarmConfig', null, function(response) {
          accountData.getAlarmConfig = response;
          defer.resolve(response);
          // acc.alarmNotification = alarm.method;
          // if (alarm.recipients) {
          //   angular.forEach(alarm.recipients, function(recipient) {
          //     if (recipient === acc.userProfile.email) {
          //       acc.alarmNotifications = true;
          //     }
          //   });
          // }
        });

        return defer.promise
      }

      this.logOut = function() {
        currentServerData = {};
      };
      /* return devices */
      this.getData = function() {
        return currentServerData;
      };
      //  return big data, not saved to IDB
      this.getBigData = function() {
        return bigServerData
      };
      // return account data
      this.getAccountData = function() {
        return accountData
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

      function openDB(db, dbV, objStore) {
        var req = window.indexedDB.open(db, dbV);

        req.onsuccess = function(e) {
          if (e.target.result.name === 'last_user') {
            IDBUserData = e.target.result;
            getDB(IDBUserData, 'last', 'user');
          } else {
            IDBServerData = e.target.result;
            getDB(IDBServerData, IDBUser.email, IDBUser.lastServer.id);
          }
        };

        req.onerror = function(e) {
          console.log('OPEN error', e);
        };

        req.onupgradeneeded = function(e) {
          var store;
          if (typeof objStore === 'object') {
            angular.forEach(objStore, function(server) {
              store = e.target.result.createObjectStore(server.id);
            })
          } else if (typeof objStore === 'string') {
            store = e.target.result.createObjectStore(objStore);
          }
        };
      };

      function putDB(idb, objStore, objStoreKey, data) {
        var req = idb.transaction(objStore, 'readwrite').objectStore(objStore).put(data, objStoreKey);;

        //var objectStore = transaction.
        req.onsuccess = function(e) {
          // console.log('PUT success', e);
        };

        req.onerror = function(e) {
          console.log('PUT ERROR', e);
        };
      };

      function getDB(idb, objStore, objStoreKey) {
        var req = idb.transaction(objStore, 'readonly').objectStore(objStore).get(objStoreKey);

        req.onsuccess = function(e) {
          if (objStoreKey === 'user' && e.target.result) {
            if (!IDBUser) {
              IDBUser = e.target.result;
            } else {
              IDBUser.IDBVersion = e.target.result.IDBVersion;
            }
            if (IDBUser && IDBUser.email) {
              openDB('users', IDBUser.IDBVersion, IDBUser.email);
            }
          } else if (Number(objStoreKey)) {
            currentServerData = e.target.result && !currentServerData.length ? e.target.result : currentServerData;
            currentServerData.user = IDBUser;
          }
        };

        req.onerror = function(e) {
          console.log('GET error', e);
        };
      };
    }]);
}());
