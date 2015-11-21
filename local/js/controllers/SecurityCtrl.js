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

      contentWrapParent.appendChild(liveStreamModal);

      document.querySelector('.full-screen-btn').onclick = function(){
        dataService.fullScreen(liveStreamImg);
      };

      angular.forEach(navToggleBtns, function(navToggle) {
        navToggle.onclick = function(e) {
          if (e.target.id === 'alarms') {
            activeLineIndicator.style.left = '60%';
            activeLineIndicator.style.width = '40%';
          } else if (e.target.id === 'surveilance') {
            activeLineIndicator.style.left = '5%';
            activeLineIndicator.style.width = '50%';
          }
        }
      })

      socket.emit('isAlarmEnabled', null, function(data) {
        console.log(data);
      });
      socket.emit('getAlarmConfig', null, function(alarmConf) {
        console.log(alarmConf);
        security.alarmNotification = alarmConf.method;
        alarmDevices = alarmConf.devices;
      });

      security.notificationsType = function(type) {
        if (type === 'gcm') {
          socket.emit('setAlarmMethod', 'gcm', function(response) {
            console.log(response);
          });
        } else if (type === 'email') {
          socket.emit('setAlarmMethod', 'email', function(response) {
            console.log(response);
          });
        }
      };
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

      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        security.liveImage = camData.thumbnail;
        console.log(camData);

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

      security.stopLiveStream = function() {
        socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        liveStreamModal.style.display = 'none';
      };

      /* stop live stream if not in security */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (to.name !== 'frame.security' && liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          liveStreamModal.style.display = 'none';
        }
      });

      /* wait on socket */
      var allDev = dataService.allDev();

      if (!allDev) {
        dataService.dataPending().then(function() {
          security.allCameras = dataService.cameras();
          security.allSensors = dataService.sensors();
        });
      } else {
        security.allCameras = dataService.cameras();
        security.allSensors = dataService.sensors();
      }
    }]);
}());
