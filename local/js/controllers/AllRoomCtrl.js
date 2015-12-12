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
      allRooms.camera = {};
      allRooms.sensor = {};
      allRooms.tvRemote = {};
      allRooms.acRemote = {};
      allRooms.mediaRemote = {};

      function sortDevices(categories, devices, remotes) {
        angular.forEach(categories, function(cat) {
          allRooms.switch[cat.id] = [];
          allRooms.light[cat.id] = [];
          allRooms.camera[cat.id] = [];
          allRooms.thermo[cat.id] = [];
          allRooms.shutter[cat.id] = [];
          allRooms.sensor[cat.id] = [];
          allRooms.tvRemote[cat.id] = [];
          allRooms.acRemote[cat.id] = [];
          allRooms.mediaRemote[cat.id] = [];

          angular.forEach(devices, function(dev) {
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
                } else if (dev.type === 'sensor') {
                  allRooms.sensor[cat.id].push(dev);
                }
              }
            });
          });

          angular.forEach(remotes, function(remote) {
            angular.forEach(remote.categories, function(remCat) {
              if (cat.id === remCat) {
                if (remote.type === 'tv') {
                  allRooms.tvRemote[cat.id].push(remote);
                } else if (remote.type === 'ac') {
                  allRooms.acRemote[cat.id].push(remote);
                } else if (remote.type === 'media') {
                  allRooms.mediaRemote[cat.id].push(remote);
                }
              }
            });
          });
        });
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

      allRooms.jumpToRoom = function(room) {
        var target = document.getElementById(room.id);
        target.parentNode.scrollTop = target.offsetTop;

        allRooms.activeRoom = room;
      };

      /* get data */
      var allDev = dataService.allDev();
      var customRemotes = dataService.allCustomRemotes();
      allRooms.categories = dataService.categories();
      allRooms.activeRoom = allRooms.categories ? allRooms.categories[0] : {};
      allRooms.favoriteSensors = allDev ? allDev.filter(function(dev){return dev.type === 'sensor' && dev.favorites}) : [];
      sortDevices(allRooms.categories, allDev, customRemotes);
      /* wait on socket than get data */
      if (!allDev || !allRooms.categories || !customRemotes) {
        dataService.dataPending().then(function() {

          allDev = dataService.allDev();
          customRemotes = dataService.allCustomRemotes();
          allRooms.categories = dataService.categories();
          allRooms.activeRoom = allRooms.categories[0];
          allRooms.favoriteSensors = allDev ? allDev.filter(function(dev){return dev.type === 'sensor' && dev.favorites}) : [];

          sortDevices(allRooms.categories, allDev, customRemotes);

          var room = document.getElementsByName('category');
          console.log(room);
        });
      };

    }]);
}());
