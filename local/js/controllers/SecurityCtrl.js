(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('SecurityCtrl', ['$scope', '$rootScope', 'dataService', 'socket', function($scope, $rootScope, dataService, socket) {

      var security = this;

      var liveStreamDev;

      var alarmDevices = [];
      // var navToggleBtns = document.querySelectorAll('.template-nav-toggle-btn');
      // var activeLineIndicator = document.querySelector('.active-line-indicator');
      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');
      // add custom modal to super parent
      contentWrapParent.appendChild(liveStreamModal);

      // get alarm status
      // socket.emit('isAlarmEnabled', null, function(data) {
      //   console.log(data);
      // });
      // get alarm configuration
      socket.emit('getAlarmConfig', null, function(alarmConf) {
        console.log(alarmConf);
        security.alarmNotification = alarmConf.method;
        alarmDevices = alarmConf.devices;
      });

      // add sensors for triggering alarm
      security.toggleAddSensor = function(id) {
        if (alarmDevices.indexOf(id) === -1) {
          alarmDevices.push(id);
          socket.emit('setAlarmDevices', alarmDevices, function(response) {
            if (response) {
              $scope.$broadcast('sensorAdded', id);
            }
          });
        } else {
          alarmDevices.splice(alarmDevices.indexOf(id), 1);
          socket.emit('setAlarmDevices', alarmDevices, function(response) {
            $scope.$broadcast('sensorRemoved', id);
          });
        }
      };

      // camera activated, start live stream
      $scope.$on('requestLiveStreamPlayback', function(event, camData) {
        liveStreamModal.style.display = 'block';
        security.liveImage = camData.thumbnail;
        liveStreamDev = camData;
      });
      // get camera live stream
      socket.on('cameraFrame', function(frame) {
        if (frame) {
          var src = dataService.blobToImage(frame.image);
          if (!src) return;
          security.liveImage = src;
        }
      });

      // // camera playback, get big modal
      // $scope.$on('requestPlayback', function(event, camRecData) {
      //   liveStreamModal.style.display = 'block';
      //   security.liveImage = camRecData.thumbnail;
      //   liveStreamDev = camRecData;
      // });

      socket.on('recordingFrame', function(frame) {
        console.log(frame);
        if (frame) {
          var src = dataService.blobToImage(frame.image);
          if (!src) return;
          security.liveImage = src;
        }
      });
      // request full screen
      security.fullScreen = function() {
        dataService.fullScreen(liveStreamImg);
      };
      //stop stream
      security.stopLiveStream = function() {
        if (liveStreamDev.type === 'camera') {
          socket.emit('stopStreaming', liveStreamDev.dev.id, liveStreamDev.options);
        } else {
          socket.emit('stopRecording', liveStreamDev.dev.id, liveStreamDev.options);
        }
        liveStreamModal.style.display = 'none';
      };

      // close livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27 && liveStreamDev.dev.id) {
          security.stopLiveStream();
        }
      };
      /* stop live stream if not in security */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamDev && liveStreamDev.dev.id) {
          security.stopLiveStream();
        }
      });

      // get data
      security.data = dataService.getData();
      console.log(security.data);
      //security.allDev = dataService.allDev() || {};
      // security.allCameras = 'camera' in allDev ? allDev.camera : [];
      // security.allSensors = 'sensor' in allDev ? allDev.sensor : [];
      //security.allRecordings = dataService.recordings();
      // if no data, wait on socket
      if (!security.data.getDevicesObj || !security.data.getRecordings) {
        dataService.getDevicesEmit().then(function(devices) {
          security.data.getDevicesObj = devices;

          dataService.getRecordingsEmit().then(function(recordings) {
            security.data.getRecordings = recordings;
          })
        })
        dataService.getServerEmits();
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        // dataService.getAllDevices().then(function(devs) {
        //   security.allDev = devs;
        //   dataService.dataPending().then(function() {
        //     security.allRecordings = dataService.recordings();
        //   });
        // });
      }
    }]);
}());
