(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('AllRoomsCtrl', ['dataService', '$scope', '$rootScope', 'socket', function(dataService, $scope, $rootScope, socket) {

      var allRooms = this;


      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');
      var liveStreamOptions, liveStreamId;

      contentWrapParent.appendChild(liveStreamModal);

      allRooms.switch = {};
      allRooms.light = {};
      allRooms.thermo = {};
      allRooms.shutter = {};
      allRooms.tvRemote = {};
      allRooms.camera = {};

      allRooms.devices = {};

      function sortDevices() {
        angular.forEach(allRooms.categories, function(cat) {
          allRooms.camera[cat.id] = [];
          allRooms.switch[cat.id] = [];
          allRooms.thermo[cat.id] = [];
          allRooms.shutter[cat.id] = [];
          allRooms.tvRemote[cat.id] = [];

          allRooms.light[cat.id] = [];

          angular.forEach(allDev, function(dev) {
            angular.forEach(dev.categories, function(devCat) {
              if (cat.id === devCat) {
                if (dev.type === 'camera') {
                  allRooms.camera[cat.id].push(dev);
                } else if (dev.type === 'switch') {
                  allRooms.switch[cat.id].push(dev);
                } else if (dev.type === 'light') {
                  allRooms.light[cat.id].push(dev);
                } else if (dev.type === 'thermo') {
                  allRooms.thermo[cat.id].push(dev);
                } else if (dev.type === 'shutter') {
                  allRooms.shutter[cat.id].push(dev);
                }
              }
            })
          })
        });
        console.log(allRooms.switch);
        console.log(allRooms.light);
      };

      /* Live stream */
      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        allRooms.liveImage = camData.thumbnail;
        console.log(camData);

        liveStreamId = camData.camId;
        liveStreamOptions = camData.video;
      });

      socket.on('cameraFrame', function(liveStream) {
        if (liveStream) {
          var src = dataService.blobToImage(liveStream.image);
          if (!src) return;
          allRooms.liveImage = src;
        }
      });

      /* full screen for cameras */
      allRooms.fullScreen = function() {
        dataService.fullScreen(liveStreamImg);
      };
      allRooms.stopLiveStream = function() {
        socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        liveStreamModal.style.display = 'none';
      };

      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (to.name !== 'frame.all-rooms' && liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          liveStreamModal.style.display = 'none';
        };
      });

      /* get data */
      var allDev = dataService.allDev();
      allRooms.categories = dataService.categories();
      var customRemotes = dataService.allCustomRemotes();
      sortDevices();
      /* wait on socket than get data */
      if (!allDev || !allRooms.categories) {
        dataService.dataPending().then(function() {

          allDev = dataService.allDev();
          allRooms.categories = dataService.categories();
          customRemotes = dataService.allCustomRemotes();

          sortDevices();
        });
      };

    }]);
}());
