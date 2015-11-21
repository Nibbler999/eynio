(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DashboardCtrl', ['$scope', '$rootScope', 'dataService', 'socket', function($scope, $rootScope, dataService, socket) {

      var dashboard = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');
      var liveStreamOptions, liveStreamId;

      contentWrapParent.appendChild(liveStreamModal);
      /* full screen for cameras */
      document.querySelector('.full-screen-btn').onclick = function() {
        dataService.fullScreen(liveStreamImg);
      };

      dashboard.allSwitches = [];
      dashboard.allLights = [];
      dashboard.allThermos = [];
      dashboard.allShutters = [];
      dashboard.allTVcustomRemotes = [];
      dashboard.allACcustomRemotes = [];
      dashboard.allMEDIAcustomRemotes = [];
      dashboard.allCameras = [];


      var sortByType = function(dev) {
        if (dev.type === 'switch') {
          dashboard.allSwitches.push(dev);
        } else
        if (dev.type === 'light') {
          dashboard.allLights.push(dev);
        } else
        if (dev.type === 'thermostat') {
          dashboard.allThermos.push(dev);
        } else
        if (dev.type === 'shutter') {
          dashboard.allShutters.push(dev);
        } else
        if (dev.type === 'camera') {
          dashboard.allCameras.push(dev);
        }
      };

      var customRemotesSortByType = function(remote) {
        if (remote.type.toLowerCase() === 'tv') {
          dashboard.allTVcustomRemotes.push(remote);
        } else if (remote.type.toLowerCase() === 'ac') {
          dashboard.allACcustomRemotes.push(remote);
        } else if (remote.type.toLowerCase() === 'media') {
          dashboard.allMEDIAcustomRemotes.push(remote);
        }
      };

      var filterDevices = function(catId) {
        angular.forEach(allDev, function(dev) {
          angular.forEach(dev.categories, function(devCat) {
            if (devCat === catId) {
              sortByType(dev);
            }
          });
        });

        angular.forEach(customRemotes, function(cRemote) {
          angular.forEach(cRemote.categories, function(cRemoteCat) {
            if (cRemoteCat === catId) {
              customRemotesSortByType(cRemote);
            }
          });
        });
      };

      /* Live stream */
      $scope.$on('requestLiveStream', function(event, camData) {
        liveStreamModal.style.display = 'block';
        dashboard.liveImage = camData.thumbnail;
        console.log(camData);

        liveStreamId = camData.camId;
        liveStreamOptions = camData.video;
      });

      socket.on('cameraFrame', function(liveStream) {
        if (liveStream) {
          var src = dataService.blobToImage(liveStream.image);
          if (!src) return;
          dashboard.liveImage = src;
        }
      });

      dashboard.stopLiveStream = function() {
        socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        liveStreamModal.style.display = 'none';
      };

      /* stop live stream if not in dashboard */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (to.name !== 'frame.dashboard' && liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          liveStreamModal.style.display = 'none';
        }
      });

      /* filter data according to selected room */
      $scope.$on('filterData', function(event, catId) {
        dashboard.allLights = [];
        dashboard.allSwitches = [];
        dashboard.allThermos = [];
        dashboard.allShutters = [];
        dashboard.allTVcustomRemotes = [];
        dashboard.allACcustomRemotes = [];
        dashboard.allMEDIAcustomRemotes = [];
        dashboard.allCameras = [];

        filterDevices(catId);
      });

      /* get data */
      var allDev = dataService.allDev();
      var customRemotes = dataService.customRemotes();
      if (sessionStorage.activeRoom) {
        filterDevices(JSON.parse(sessionStorage.activeRoom).id);
      } else {
        filterDevices('dashboard');
      }
      /* wait on socket than get data */
      if (!allDev) {
        dataService.dataPending().then(function() {

          allDev = dataService.allDev();
          customRemotes = dataService.customRemotes();
          if (sessionStorage.activeRoom) {
            filterDevices(JSON.parse(sessionStorage.activeRoom).id);
          } else {
            filterDevices('dashboard');
          }
        });
      };

    }]);
}());
