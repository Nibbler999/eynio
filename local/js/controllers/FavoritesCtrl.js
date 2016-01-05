(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('FavoritesCtrl', ['$scope', '$rootScope', 'socket', 'dataService', function($scope, $rootScope, socket, dataService) {

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

      // stop livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27) {
          if (liveStreamId) {
            socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          };
          liveStreamModal.style.display = 'none';
        }
      };
      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        };
        liveStreamModal.style.display = 'none';
      });

      /* get data */
        favorites.allDev = dataService.allDev();
        favorites.allRemotes = dataService.allCustomRemotes();
      if(!favorites.allDev || !favorites.allRemotes) {
        dataService.dataPending().then(function() {
          favorites.allDev = dataService.allDev();
          favorites.allRemotes = dataService.allCustomRemotes();
        });
      }
    }]);
}());
