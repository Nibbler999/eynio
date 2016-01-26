(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('MostUsedCtrl', ['$scope', '$rootScope', 'socket', 'dataService', function($scope, $rootScope, socket, dataService) {

      var mostUsed = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');

      var liveStreamDev;

      contentWrapParent.appendChild(liveStreamModal);

      /* Live stream */
      $scope.$on('requestLiveStreamPlayback', function(event, camData) {
        liveStreamModal.style.display = 'block';
        mostUsed.liveImage = camData.thumbnail;
        liveStreamDev = camData
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
        socket.emit('stopStreaming', liveStreamDev.dev.id, liveStreamDev.options);
        liveStreamModal.style.display = 'none';
      };

      // stop livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27 && liveStreamDev.dev.id) {
          mostUsed.stopLiveStream();
        }
      };
      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamDev && liveStreamDev.dev.id) {
          mostUsed.stopLiveStream();
        };
      });


      /* get data */
      mostUsed.data = dataService.getData();

      if (mostUsed.data.getDevicesArray) {

        mostUsed.allDevArray = mostUsed.data.getDevicesArray.filter(function(dev){
          return dev.usecount
        }).sort(function(a ,b){
          return b.usecount - a.usecount;
        });
      } else {
        dataService.getDevicesEmit().then(function(devices){
          mostUsed.data = dataService.getData();
          mostUsed.allDevArray = mostUsed.data.getDevicesArray.filter(function(dev){
            return dev.usecount
          }).sort(function(a ,b){
            return b.usecount - a.usecount;
          });
        })
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
        dataService.getServerEmits();
      }
    }]);
}());
