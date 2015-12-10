(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('MostUsedCtrl', ['$scope', '$rootScope', 'socket', 'dataService', function($scope, $rootScope, socket, dataService) {

      var mostUsed = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');

      var liveStreamOptions, liveStreamId;

      contentWrapParent.appendChild(liveStreamModal);

      /* Live stream */
      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        mostUsed.liveImage = camData.thumbnail;
        console.log(camData);

        liveStreamId = camData.camId;
        liveStreamOptions = camData.video;
      });

      socket.on('cameraFrame', function(liveStream) {
        if (liveStream) {
          var src = dataService.blobToImage(liveStream.image);
          if (!src) return;
          mostUsed.liveImage = src;
        }
      });

      /* full screen for cameras */
      mostUsed.fullScreen = function() {
        dataService.fullScreen(liveStreamImg);
      };
      mostUsed.stopLiveStream = function() {
        socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        liveStreamModal.style.display = 'none';
      };

      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (to.name !== 'frame.most-used' && liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          liveStreamModal.style.display = 'none';
        };
      });


      /* get data */
      var allDev = dataService.allDev();
      var allRemotes = dataService.allCustomRemotes();

      if (allDev) {
        // add remotes to array
        // angular.forEach(allRemotes, function(rem) {
        //   allDev.push(rem);
        // });
        // filter array by use count and sort
        allDev = allDev.filter(function(dev) {
          return dev.usecount
        }).sort(function(a, b) {
          return b.usecount - a.usecount;
        });

        mostUsed.allDev = allDev;
      } else if (!allDev) {
        dataService.dataPending().then(function() {
          allDev = dataService.allDev();
          allRemotes = dataService.allCustomRemotes();
          // add remotes to array
          // angular.forEach(allRemotes, function(rem) {
          //   allDev.push(rem);
          // });
          // filter array by use count and sort
          allDev = allDev.filter(function(dev) {
            return dev.usecount
          }).sort(function(a, b) {
            return b.usecount - a.usecount;
          });

          mostUsed.allDev = allDev
        });
      }
    }]);
}());
