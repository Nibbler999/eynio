(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('FavoritesCtrl', ['$scope', '$rootScope', '$timeout', 'socket', 'dataService', function($scope, $rootScope, $timeout, socket, dataService) {

      var favorites = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');
      var favoritesWrap = document.getElementById('favorites-wrap');

      var liveStreamDev;

      contentWrapParent.appendChild(liveStreamModal);


      /* Live stream */
      $scope.$on('requestLiveStreamPlayback', function(event, camData) {
        liveStreamModal.style.display = 'block';
        favorites.liveImage = camData.thumbnail;
        liveStreamDev = camData
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
        socket.emit('stopStreaming', liveStreamDev.dev.id, liveStreamDev.options);
        liveStreamModal.style.display = 'none';
      };

      // stop livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27 && liveStreamDev.dev.id) {
          favorites.stopLiveStream();
        }
      };
      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamDev && liveStreamDev.dev.id) {
          favorites.stopLiveStream();
        };
      });

      $timeout(function() {
        console.log(favoritesWrap.children.length);
        if(favoritesWrap.children.length === 1){
          document.querySelector('small.color-transparent').classList.remove('hidden')
        }
      }, 750);
      /* get data */
      favorites.data = dataService.getData();

      if (!favorites.data.getDevicesObj) {
        dataService.getDevicesEmit().then(function(devices) {
          favorites.data.getDevicesObj = devices;
        })
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
        dataService.getServerEmits();
      }
    }]);
}());
