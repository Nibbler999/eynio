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
      var allDev = dataService.allDev();
      var allDevArray = [];
      var allRemotes = dataService.allCustomRemotes();

      if (allDev && allRemotes) {  mostUsed.allTvRemotes = allRemotes.tv;
        mostUsed.allAvRemotes = allRemotes.ac;
        mostUsed.allMultuRemotes = allRemotes.multi;

        angular.forEach(allDev, function(devTypeArray) {
          angular.forEach(devTypeArray, function(dev) {
            allDevArray.push(dev);
          })
        });
        allDevArray = allDevArray.sort(function(a, b) {
          return b.usecount - a.usecount
        });


        mostUsed.allTvRemotes = mostUsed.allTvRemotes.filter(function(rem) {
          return rem.usecount
        }).sort(function(a, b) {
          return b.usecount - a.usecount
        });

        mostUsed.allDev = allDevArray;
      } else if (!allDev) {
        dataService.dataPending().then(function() {
          allDev = dataService.allDev();
          allRemotes = dataService.allCustomRemotes();

          mostUsed.allTvRemotes = allRemotes.tv;
          mostUsed.allAvRemotes = allRemotes.ac;
          mostUsed.allMultuRemotes = allRemotes.multi;

          angular.forEach(allDev, function(devTypeArray) {
            angular.forEach(devTypeArray, function(dev) {
              allDevArray.push(dev);
            })
          });
          allDevArray = allDevArray.sort(function(a, b) {
            return b.usecount - a.usecount
          });


          mostUsed.allTvRemotes = mostUsed.allTvRemotes.filter(function(rem) {
            return rem.usecount
          }).sort(function(a, b) {
            return b.usecount - a.usecount
          });

          mostUsed.allDev = allDevArray;
        });
      }
    }]);
}());
