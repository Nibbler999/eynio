(function() {
  "use strict";

  angular
    .module('nHome')
    .directive('camera', ['$rootScope', '$state', 'dataService',
      'socket', '$q',
      function($rootScope, $state, dataService, socket, $q) {
        return {
          restrict: 'E',
          replace: true,
          scope: {
            cinfo: '='
          },
          templateUrl: 'directive/devices/camera.html',
          link: function(scope, elem, attr) {

            var apiKey;
            scope.currentState = $state.current.name;
            var serverId = sessionStorage.activeServerId;

            var options = {
              width: -1,
              height: -1,
              framerate: 1
            };

            socket.emit('getCachedThumbnail', scope.cinfo.id, function(thumbnail) {
              if (!thumbnail) {
                scope.thumbnailImg = false;
              } else {
                scope.thumbnailImg = dataService.blobToImage(thumbnail);
              }
            });


            if (scope.currentState === 'frame.devices') {
              return false
            } else {

              scope.getLiveThumbnail = function(camId) {
                socket.emit('getLiveThumbnail', camId, function(data) {
                  scope.thumbnailImg = dataService.blobToImage(data);
                });
              };

              scope.refreshFeed = function(cam) {
                if (cam.snapshot) {
                  socket.emit('testStreamURL', cam.snapshot, function(response) {
                    if (response) {
                      socket.emit('getCachedThumbnail', scope.cinfo.id, function(thumbnail) {
                        if (!thumbnail) {
                          scope.thumbnailImg = false;
                        } else {
                          scope.thumbnailImg = dataService.blobToImage(thumbnail);
                        }
                      });
                    }
                  })
                }
              };
              scope.requestLiveStream = function(camId) {
                socket.emit('requestStreaming', camId, options);

                $rootScope.$broadcast('requestLiveStream', {
                  camId: camId,
                  thumbnail: scope.thumbnailImg,
                  video: options
                });
              };
              scope.toggleAddToFavorites = function(favorites, devId) {
                if (favorites) {
                  socket.emit4('setUserProperty', devId, 'favorites', true);
                } else {
                  socket.emit4('setUserProperty', devId, 'favorites', false);
                }
              };
            }
            /* socket events */
            socket.on('cameraUpdated', function(camUpdateData) {
              if (scope.cinfo.id === camUpdateData.id) {
                scope.cinfo = camUpdateData;
              }
            });
          }
        };
      }
    ])
}());
