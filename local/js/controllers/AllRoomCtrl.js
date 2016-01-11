(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('AllRoomsCtrl', ['dataService', '$scope', '$rootScope', 'socket', '$state', function(dataService, $scope, $rootScope, socket, $state) {

      var allRooms = this;


      var contentWrapParent = document.querySelector('.frame-page-content-wrap');
      var liveStreamModal = document.querySelector('.cam-live-stream-modal');
      var liveStreamImg = document.querySelector('.camera-live-stream');
      var liveStreamOptions, liveStreamId;

      contentWrapParent.appendChild(liveStreamModal);

      function sortDevices(categories, devices, remotes) {
        // wild sorting
        angular.forEach(devices, function(devTypeArray, type){
          allRooms[type] = {};
          angular.forEach(categories, function (cat) {
            allRooms[type][cat.id] = allRooms[type][cat.id] || [];

            angular.forEach(devTypeArray, function(dev){
              angular.forEach(dev.categories, function(devCat){
                if(devCat === cat.id){
                  allRooms[type][cat.id].push(dev);
                }
              });
            });
          });
        });

        angular.forEach(remotes, function(remTypeArray, type){
          allRooms[type] = {};
          angular.forEach(categories, function(cat){
            allRooms[type][cat.id] = allRooms[type][cat.id] || [];

            angular.forEach(remTypeArray, function(rem){
              angular.forEach(rem.categories, function(remCat){
                if(remCat === cat.id){
                  allRooms[type][cat.id].push(rem);
                }
              })
            })
          })
        })
      };

      allRooms.changeCategoryName = function(cat) {
        socket.emit('catUpdate', cat.id, {
          name: cat.name
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
      document.addEventListener("fullscreenchange",  function(e){
        console.log(e);
        console.log('bbb');
      })
      // stop livestream on ESC
      document.body.onkeyup = function(e) {
        if (e.keyCode === 27) {
          if (liveStreamId) {
            socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
          };
          liveStreamModal.style.display = 'none';
        }
      };

      // allRooms.favoritesSensors = function() {
      //     console.log('a');
      //     $rootScope.$broadcast('favoritesSensors');
      //     $state.go('frame.devices')
      //   }
      /* stop live stream if not in all rooms */
      $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
        if (liveStreamId) {
          socket.emit('stopStreaming', liveStreamId, liveStreamOptions);
        };
        liveStreamModal.style.display = 'none';
      });

      // allRooms.jumpToRoom = function(room) {
      //   var target = document.getElementById(room.id);
      //   target.parentNode.scrollTop = target.offsetTop;
      //
      //   allRooms.activeRoom = room;
      // };
      // add new category
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
      //delete category
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

      /* get data */
      var allDev = dataService.allDev();
      var customRemotes = dataService.allCustomRemotes();
      allRooms.categories = dataService.categories();
      allRooms.activeRoom = allRooms.categories ? allRooms.categories[0] : {};
      allRooms.favoriteSensors = allDev ? allDev.sensor ? allDev.sensor.filter(function(dev) {
        return dev.type === 'sensor' && dev.favorites
      }) : [] : [];
      sortDevices(allRooms.categories, allDev, customRemotes);
      /* wait on socket than get data */
      if (!allDev || !allRooms.categories || !customRemotes) {
        dataService.dataPending().then(function() {

          allDev = dataService.allDev();
          customRemotes = dataService.allCustomRemotes();
          allRooms.categories = dataService.categories();
          allRooms.activeRoom = allRooms.categories[0];
          allRooms.favoriteSensors = allDev ? allDev.sensor ? allDev.sensor.filter(function(dev) {
            return dev.type === 'sensor' && dev.favorites
          }) : [] : [];
          sortDevices(allRooms.categories, allDev, customRemotes);
        });
      };

    }]);
}());
