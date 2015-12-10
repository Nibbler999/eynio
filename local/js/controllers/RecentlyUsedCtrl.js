(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('RecentlyUsedCtrl', ['$scope', '$rootScope', 'socket', 'dataService', function($scope, $rootScope, socket, dataService) {

      var recently = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');

      var liveStreamOptions, liveStreamId;

      contentWrapParent.appendChild(liveStreamModal);

      /* Live stream */
      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        recently.liveImage = camData.thumbnail;
        console.log(camData);

        liveStreamId = camData.camId;
        liveStreamOptions = camData.video;
      });

      socket.on('cameraFrame', function(liveStream) {
        if (liveStream) {
          var src = dataService.blobToImage(liveStream.image);
          if (!src) return;
          recently.liveImage = src;
        }
      });

      /* full screen for cameras */
      recently.fullScreen = function() {
        dataService.fullScreen(liveStreamImg);
      };
      recently.stopLiveStream = function() {
        socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        liveStreamModal.style.display = 'none';
      };

      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (to.name !== 'frame.recently-used' && liveStreamId) {
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
        // filter array by user
        recently.allDev = allDev.filter(function(dev) {
          if (dev.last_activated) {
            return dev.last_activated.by === JSON.parse(sessionStorage.userInfoData).user_name;
          }
        });
        // sort array by last activated
        recently.allDev.sort(function(a, b) {
          return Date.parse(b.last_activated.at) - Date.parse(a.last_activated.at);
        });
      } else if (!allDev) {
        dataService.dataPending().then(function() {
          allDev = dataService.allDev();
          allRemotes = dataService.allCustomRemotes();
          // add remotes to array
          // angular.forEach(allRemotes, function(rem) {
          //   allDev.push(rem);
          // });
          // filter array by user and sort
          recently.allDev = allDev.filter(function(dev) {
            if (dev.last_activated) {
              return dev.last_activated.by === JSON.parse(sessionStorage.userInfoData).user_name;
            }
          }).sort(function(a, b) {
            return Date.parse(b.last_activated.at) - Date.parse(a.last_activated.at);
          });
        });
      }
    }]);
}());
