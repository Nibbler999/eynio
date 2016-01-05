(function() {
  "use strict";

  angular
    .module('services')
    .directive('devicesDev', ['$rootScope', 'socket', function($rootScope, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/devices-dev.html',
        scope: {
          devinfo: '='
        },
        link: function(scope, elem, attr) {

          // device icon
          switch (scope.devinfo.type) {
            case 'switch':
              if (scope.devinfo.value) {
                scope.devIcon = 'img/device/switch-on.png';
              } else {
                scope.devIcon = 'img/device/switch-off.png';
              }
              break;
            case 'light':
              if (scope.devinfo.state.on) {
                scope.devIcon = 'img/device/light-on.png';
              } else {
                scope.devIcon = 'img/device/light-off.png';
              }
              break;
            case 'shutter':
              if (scope.devinfo.value > 50) {
                scope.devIcon = 'img/device/shutter-on.png';
              } else {
                scope.devIcon = 'img/device/shutter-off.png';
              }
              break;
            case 'thermostat':
              scope.devIcon = 'img/device/thermostat.png';
              break;
            case 'tv':
              scope.devIcon = 'img/device/remote.png';
              break;
            case 'camera':
              scope.devIcon = 'img/device/camera.png';
              break;
            case 'sensor':
              if (scope.devinfo.subtype === 'temperature') {
                scope.devIcon = 'img/sensors/temp.png';
              } else if (scope.devinfo.subtype === 'humidity') {
                scope.devIcon = 'img/sensors/humidity.png';
              } else if (scope.devinfo.subtype === 'co2') {
                scope.devIcon = 'img/sensors/co.png';
              } else if (scope.devinfo.subtype === 'noise') {
                scope.devIcon = 'img/sensors/noise.png';
              } else if (scope.devinfo.subtype === 'rain') {
                scope.devIcon = 'img/sensors/rain.png';
              } else if (scope.devinfo.subtype === 'light') {
                scope.devIcon = 'img/sensors/lux.png';
              } else if (scope.devinfo.subtype === 'rain') {
                scope.devIcon = 'img/sensors/rain.png';
              } else if (scope.devinfo.subtype === 'motion') {
                scope.devIcon = 'img/sensors/motion.png';
              } else if (scope.devinfo.subtype === 'door') {
                if (scope.devinfo.value) {
                  scope.devIcon = 'img/sensors/door-open.png';
                } else {
                  scope.devIcon = 'img/sensors/door-close.png';
                }
              } else if (scope.devinfo.subtype === 'pressure') {
                scope.devIcon = 'img/sensors/pressure.png';
              } else if (scope.devinfo.subtype === 'co-alarm') {
                scope.devIcon = 'img/sensors/co.png';
              }
              break;
          }
          scope.deviceFavorites = scope.devinfo.favorites ? 'img/button/favorite-white.png' : 'img/button/favorite-hollow.png';

          scope.editDevice = function(dev) {
            $rootScope.$broadcast('editDevice', dev);
          };

          scope.blacklistDev = function(dev) {
            if (dev.type === 'tv') {
              socket.emit('deleteCustomRemote', dev.id);
            } else if (dev.type === 'camera') {
              socket.emit('deleteCamera', dev.id);
            } else {
              socket.emit('blacklistDevice', dev.id, function(response) {
                if (response) {
                  scope.devinfo.blacklisted = true;
                }
              });
            }
          };

          scope.unblacklistDev = function(dev) {
            socket.emit('unblacklistDevice', dev.id, function(response) {
              if (response) {
                scope.devinfo.blacklisted = false;
              }
            });
          };

          scope.toggleAddToFavorites = function(favorites, devId) {
            if (!favorites) {
              socket.emit4('setUserProperty', devId, 'favorites', true);
              scope.devinfo.favorites = true;
            } else {
              socket.emit4('setUserProperty', devId, 'favorites', false);
              scope.devinfo.favorites = false;
            }
            scope.deviceFavorites = scope.devinfo.favorites ? 'img/button/favorite-white.png' : 'img/button/favorite-hollow.png';
          };
        }
      }
    }])
}());
