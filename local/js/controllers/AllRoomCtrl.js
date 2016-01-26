(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('AllRoomsCtrl', ['dataService', '$scope', '$rootScope', 'socket', '$state', function(dataService, $scope, $rootScope, socket, $state) {

      var allRooms = this;

      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');
      var liveStreamDev;

      contentWrapParent.appendChild(liveStreamModal);

      function sortDevices(categories, devices) {
        // wild sorting

        angular.forEach(categories, function(cat) {
          allRooms[cat.id] = {};
          angular.forEach(devices, function(devArray, type) {
            allRooms[cat.id][type] = allRooms[cat.id][type] || [];

            angular.forEach(devArray, function(dev) {
              if (dev.category === cat.id) {
                allRooms[cat.id][type].push(dev);
              }
            })
          })
        });
      };

      allRooms.changeCategoryName = function(cat) {
        socket.emit('catUpdate', cat.id, {
          name: cat.name
        });
      };
      allRooms.addRoom = function(e) {
        socket.emit('catAdd', {
          name: e.target.children[0].value
        }, function(response) {
          if (response) {
            allRooms.categories.push({
              id: response,
              name: e.target.children[0].value
            });
            e.target.children[0].value = '';
            allRooms.addRoomForm = false;
          }
          console.log(response);
        });
      };
      allRooms.deleteCategory = function(cat) {
        socket.emit('catDelete', cat.id, function(response) {
          console.log(response);
          if (response) {
            angular.forEach(allRooms.categories, function(category) {
              if (category.id === cat.id) {
                allRooms.categories.splice(allRooms.categories.indexOf(category), 1);
              }
            })
          }
        })
      };

      /* full screen for cameras */
      allRooms.fullScreen = function() {
        dataService.fullScreen(liveStreamImg);
      };
      allRooms.stopLiveStream = function() {
        socket.emit('stopStreaming', liveStreamDev.dev.id, liveStreamDev.options);
        liveStreamModal.style.display = 'none';
      };
      /* Live stream */
      $scope.$on('requestLiveStreamPlayback', function(event, camData) {
        liveStreamModal.style.display = 'block';
        allRooms.liveImage = camData.thumbnail;
        liveStreamDev = camData;
      });

      socket.on('cameraFrame', function(liveStream) {
        if (liveStream) {
          var src = dataService.blobToImage(liveStream.image);
          if (!src) return;
          allRooms.liveImage = src;
        }
      });
      // stop livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27 && liveStreamDev.dev.id) {
          allRooms.stopLiveStream();
        }
      };

      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamDev && liveStreamDev.dev.id) {
          allRooms.stopLiveStream();
        };
      });

      /* get data */
      console.log('PPPPPPPPPPPP', allRooms.data);
      allRooms.data = dataService.getData() || {};
      console.log(allRooms.data);
      //allRooms.categories = dataService.categories();
      //allRooms.activeRoom = allRooms.categories ? allRooms.categories[0] : {};
      allRooms.favoriteSensors = allRooms.data.getDevicesObj && 'sensor' in allRooms.data.getDevicesObj ? allRooms.data.getDevicesObj.sensor.filter(function(dev) {
        return dev.favorites
      }) : [];
      sortDevices(allRooms.data.getCategories, allRooms.data.getDevicesObj);

      console.log('AAAAAAAAAAAAAA', allRooms.data);
      console.log(allRooms.data.getBlacklisted);
      /* wait on socket than get data */
      if (!allRooms.data.getBlacklisted || !allRooms.data.getDevicesObj || !allRooms.data.getCategories) {
        dataService.getCategoriesEmit().then(function(cats) {
          allRooms.data = dataService.getData() || {};
          allRooms.data.getCategories = cats;

          allRooms.favoriteSensors = allRooms.data.getDevicesObj && 'sensor' in allRooms.data.getDevicesObj ? allRooms.data.getDevicesObj.sensor.filter(function(dev) {
            return dev.favorites
          }) : [];
          sortDevices(allRooms.data.getCategories, allRooms.data.getDevicesObj);

          dataService.getDevicesEmit().then(function(devs) {
            console.log('BBBBBBBBBBBB', allRooms.data);
            allRooms.data.getDevicesObj = devs;

            allRooms.favoriteSensors = 'sensor' in allRooms.data.getDevicesObj ? allRooms.data.getDevicesObj.sensor.filter(function(dev) {
              return dev.favorites
            }) : [];
            sortDevices(allRooms.data.getCategories, allRooms.data.getDevicesObj);
          });
        });
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
        dataService.getServerEmits();
      }
    }]);
}());
