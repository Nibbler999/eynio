(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('FavoritesCtrl', ['dataService', 'socket', '$scope', '$rootScope', function(dataService, socket, $scope, $rootScope) {

      var favorites = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');

      var liveStreamOptions, liveStreamId;

      contentWrapParent.appendChild(liveStreamModal);


      /* Live stream */
      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        favorites.liveImage = camData.thumbnail;
        console.log(camData);

        liveStreamId = camData.camId;
        liveStreamOptions = camData.video;
      });

      socket.on('cameraFrame', function(liveStream) {
        if (liveStream) {
          var src = dataService.blobToImage(liveStream.image);
          if (!src) return;
          favorites.liveImage = src;
        }
      });

      /* full screen for cameras */
      favorites.fullScreen = function() {
        dataService.fullScreen(liveStreamImg);
      };
      favorites.stopLiveStream = function() {
        socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        liveStreamModal.style.display = 'none';
      };

      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (to.name !== 'frame.favorites' && liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          liveStreamModal.style.display = 'none';
        };
      });

      /* get data */
      var allDev = dataService.allDev();
      var allRemotes = dataService.allCustomRemotes();
      /* wait on socket to connect than get data */
      if (!allDev) {
        dataService.dataPending().then(function() {

          allDev = dataService.allDev();
          allRemotes = dataService.allCustomRemotes();

          favorites.allLights = dataService.sortDevicesByType(allDev, 'light').filter(function(dev) {
            return dev.favorites;
          });
          favorites.allSwitches = dataService.sortDevicesByType(allDev, 'switch').filter(function(dev) {
            return dev.favorites;
          });
          favorites.allThermos = dataService.sortDevicesByType(allDev, 'thermostat').filter(function(dev) {
            return dev.favorites;
          });
          favorites.allShutters = dataService.sortDevicesByType(allDev, 'shutter').filter(function(dev) {
            return dev.favorites;
          });
          favorites.allCameras = dataService.sortDevicesByType(allDev, 'camera').filter(function(dev) {
            return dev.favorites;
          });
          favorites.allSensors = dataService.sortDevicesByType(allDev, 'sensor').filter(function(dev) {
            return dev.favorites;
          });


          favorites.allTvRemotes = dataService.sortRemotesByType(allRemotes, 'tv').filter(function(dev) {
            return dev.favorites;
          });
        });
      } else {

        allDev = dataService.allDev();
        allRemotes = dataService.allCustomRemotes();

        favorites.allLights = dataService.sortDevicesByType(allDev, 'light').filter(function(dev) {
          return dev.favorites;
        });
        favorites.allSwitches = dataService.sortDevicesByType(allDev, 'switch').filter(function(dev) {
          return dev.favorites;
        });
        favorites.allThermos = dataService.sortDevicesByType(allDev, 'thermostat').filter(function(dev) {
          return dev.favorites;
        });
        favorites.allShutters = dataService.sortDevicesByType(allDev, 'shutter').filter(function(dev) {
          return dev.favorites;
        });
        favorites.allCameras = dataService.sortDevicesByType(allDev, 'camera').filter(function(dev) {
          return dev.favorites;
        });
        favorites.allSensors = dataService.sortDevicesByType(allDev, 'sensor').filter(function(dev) {
          return dev.favorites;
        });


        favorites.allTvRemotes = dataService.sortRemotesByType(allRemotes, 'tv').filter(function(dev) {
          return dev.favorites;
        });
      }
    }]);
}());
