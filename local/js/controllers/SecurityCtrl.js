(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('SecurityCtrl', ['$scope', '$rootScope', 'dataService', 'socket', function($scope, $rootScope, dataService, socket) {

      var security = this;

      var liveStreamOptions, liveStreamId;

      var alarmDevices = [];
      var navToggleBtns = document.querySelectorAll('.template-nav-toggle-btn');
      var activeLineIndicator = document.querySelector('.active-line-indicator');
      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');
      // add custom modal to super parent
      contentWrapParent.appendChild(liveStreamModal);

      // get alarm status
      socket.emit('isAlarmEnabled', null, function(data) {
        console.log(data);
      });
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
      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        security.liveImage = camData.thumbnail;
        liveStreamId = camData.camId;
        liveStreamOptions = camData.video;
      });
      socket.on('cameraFrame', function(liveStream) {
        if (liveStream) {
          var src = dataService.blobToImage(liveStream.image);
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
        socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        liveStreamModal.style.display = 'none';
      };

      // close livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27) {
          if (liveStreamId) {
            socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          }
          liveStreamModal.style.display = 'none';
        }
      };
      /* stop live stream if not in security */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        }
        liveStreamModal.style.display = 'none';
      });

      // get data
      var allDev = dataService.allDev();
      security.allCameras = allDev ? allDev.camera : [];
      security.allSensors = allDev ? allDev.sensor : [];
      // if no data, wait on socket
      if (!allDev) {
        dataService.dataPending().then(function() {
          allDev = dataService.allDev();
          security.allCameras = allDev.camera;
          security.allSensors = allDev.sensor;
        });
      }
    }]);
}());
