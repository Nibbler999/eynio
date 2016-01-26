(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('RecentlyUsedCtrl', ['$scope', '$rootScope', 'socket', 'dataService', function($scope, $rootScope, socket, dataService) {

      var recently = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');

      var liveStreamDev;

      contentWrapParent.appendChild(liveStreamModal);

      /* Live stream */
      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        recently.liveImage = camData.thumbnail;
        console.log(camData);
        liveStreamDev = camData;
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
        socket.emit('stopStreaming', liveStreamDev.dev.id, liveStreamDev.options);
        liveStreamModal.style.display = 'none';
      };

      // stop livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27 && liveStreamDev.dev.id) {
          recently.stopLiveStream();
        }
      };
      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamDev && liveStreamDev.dev.id) {
          recently.stopLiveStream();
        };
        liveStreamModal.style.display = 'none';
      });


      /* get data */
      recently.data = dataService.getData();

      if (recently.data.getDevicesArray) {

        recently.allDevArray = recently.data.getDevicesArray.filter(function(dev) {
          return dev.lastused
        }).sort(function(a, b) {
          return Date.parse(b.lastused) - Date.parse(a.lastused)
        });
      } else {
        dataService.getDevicesEmit().then(function(devices) {
          recently.data = dataService.getData();
          recently.allDevArray = recently.data.getDevicesArray.filter(function(dev) {
            return dev.lastused
          }).sort(function(a, b) {
            return Date.parse(b.lastused) - Date.parse(a.lastused)
          });
        });
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
        dataService.getServerEmits();
      }
    }]);
}());
