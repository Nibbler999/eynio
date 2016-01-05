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
      var allRemotesArray = [];

      if (allDev) {

        angular.forEach(allDev, function(devTypeArray) {
          angular.forEach(devTypeArray, function(dev) {
            allDevArray.push(dev);
          })
        });

        recently.allDev = allDevArray.filter(function(dev) {
          if (dev.last_activated) {
            return dev.last_activated.by === JSON.parse(sessionStorage.userInfoData).user_name
          }
        }).sort(function(a, b) {
          return Date.parse(b.last_activated) - Date.parse(a.last_activated);
        });

        angular.forEach(allRemotes, function(remTypeArray) {
          angular.forEach(remTypeArray, function(rem) {
            allRemotesArray.push(rem);
          });
        });

        recently.allRemotes = allRemotesArray.filter(function(rem) {
          if (rem.last_activated) {
            return rem.last_activated.by === JSON.parse(sessionStorage.userInfoData).user_name
          }
        }).sort(function(a, b) {
          return Date.parse(b.last_activated) - Date.parse(a.last_activated);
        });
      } else if (!allDev) {
        dataService.dataPending().then(function() {
          allDev = dataService.allDev();
          allRemotes = dataService.allCustomRemotes();

          angular.forEach(allDev, function(devTypeArray) {
            angular.forEach(devTypeArray, function(dev) {
              allDevArray.push(dev);
            })
          });

          recently.allDev = allDevArray.filter(function(dev) {
            if (dev.last_activated) {
              return dev.last_activated.by === JSON.parse(sessionStorage.userInfoData).user_name
            }
          }).sort(function(a, b) {
            return Date.parse(b.last_activated) - Date.parse(a.last_activated);
          });

          angular.forEach(allRemotes, function(remTypeArray) {
            angular.forEach(remTypeArray, function(rem) {
              allRemotesArray.push(rem);
            });
          });

          recently.allRemotes = allRemotesArray.filter(function(rem) {
            if (rem.last_activated) {
              return rem.last_activated.by === JSON.parse(sessionStorage.userInfoData).user_name
            }
          }).sort(function(a, b) {
            return Date.parse(b.last_activated) - Date.parse(a.last_activated);
          });
        });
      }
    }]);
}());
