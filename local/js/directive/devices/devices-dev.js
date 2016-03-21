(function() {
  "use strict";

  angular
    .module('services')
    .directive('devicesDev', ['socket', function(socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/devices-dev.html',
        scope: {
          devinfo: '='
        },
        controllerAs: 'devicesDevCtrl',
        controller: ['$scope', function($scope) {

          var devicesDevCtrl = this;
          var deviceObj = $scope.devinfo;
          var doubleCheckDelete = 0;

          /**
           * @name setDeviceIcon
           * @desc set proper device icon
           * @type {function}
           * @param {devObj} device object
           */
          function setDeviceIcon(devObj) {
            switch (devObj.type) {
              case 'switch':
                if (devObj.value) {
                  devicesDevCtrl.deviceIcon = 'img/device/switch-on.png';
                } else {
                  devicesDevCtrl.deviceIcon = 'img/device/switch-off.png';
                }
                break;
              case 'light':
                if (devObj.state.on) {
                  devicesDevCtrl.deviceIcon = 'img/device/light-on.png';
                } else {
                  devicesDevCtrl.deviceIcon = 'img/device/light-off.png';
                }
                break;
              case 'shutter':
                if (devObj.value > 50) {
                  devicesDevCtrl.deviceIcon = 'img/device/shutter-on.png';
                } else {
                  devicesDevCtrl.deviceIcon = 'img/device/shutter-off.png';
                }
                break;
              case 'thermostat':
                devicesDevCtrl.deviceIcon = 'img/device/thermostat.png';
                break;
              case 'remote':
                devicesDevCtrl.deviceIcon = 'img/device/remote.png';
                break;
              case 'camera':
                devicesDevCtrl.deviceIcon = 'img/device/camera.png';
                break;
              case 'sensor':
                switch (deviceObj.subtype) {
                  case 'co-alarm':
                    devicesDevCtrl.deviceIcon = 'img/sensors/co.png';
                    break;
                  case 'co2':
                    devicesDevCtrl.deviceIcon = 'img/sensors/co2.png';
                    break;
                  case 'door':
                    devicesDevCtrl.deviceIcon = deviceObj.value ? 'img/sensors/door-open.png' : 'img/sensors/door-close.png';
                    break;
                  case 'humidity':
                    devicesDevCtrl.deviceIcon = 'img/sensors/humidity.png';
                    break;
                  case 'light':
                    devicesDevCtrl.deviceIcon = 'img/sensors/lux.png';
                    break;
                  case 'motion':
                    devicesDevCtrl.deviceIcon = 'img/sensors/motion.png';
                    break;
                  case 'noise':
                    devicesDevCtrl.deviceIcon = 'img/sensors/noise.png';
                    break;
                  case 'pressure':
                    devicesDevCtrl.deviceIcon = 'img/sensors/pressure.png';
                    break;
                  case 'rain':
                    devicesDevCtrl.deviceIcon = 'img/sensors/rain.png';
                    break;
                  case 'smoke-alarm':
                    devicesDevCtrl.deviceIcon = 'img/sensors/smoke.png';
                    break;
                  case 'temperature':
                    devicesDevCtrl.deviceIcon = 'img/sensors/temp.png';
                    break;
                }
                break;
            }
          }
          /**
           * @name editDevice
           * @desc open modal for editing device
           * @type {function}
           * @param {devObj} device object
           */
          function editDevice(devObj) {
            $scope.$emit('editDevice', devObj);
          };
          /**
           * @name blacklistDevice
           * @desc blacklist device, removes it from all rooms and it's not available for actions
           * @type {function}
           * @param {devObj} device object
           */
          function blacklistDevice(devObj) {
            doubleCheckDelete += 1;
            if (devObj.type === 'remote' && doubleCheckDelete === 2) {
              socket.emit('deleteCustomRemote', devObj.id);
            } else if (devObj.type === 'camera' && doubleCheckDelete === 2) {
              socket.emit('deleteCamera', devObj.id);
            } else if (devObj.type != 'camera' && devObj.type != 'remote') {
              socket.emit('blacklistDevice', devObj.id, function(response) {
                if (response) {
                  deviceObj.blacklisted = true;
                }
              });
            }
          };
          /**
           * @name unblacklistDevice
           * @desc un blacklist device
           * @type {function}
           * @param {devObj} device object
           */
          function unblacklistDevice(devObj) {
            socket.emit('unblacklistDevice', devObj.id, function(response) {
              if (response) {
                deviceObj.blacklisted = false;
              }
            });
          };
          /**
           * @name toggleDeviceFavorites
           * @desc add or remove device from favorites
           * @type {function}
           * @param {devId, devFav} device id, device favorites
           */
          function toggleDeviceFavorites(devId, devFav) {
            if (!devFav) {
              socket.emit4('setUserProperty', devId, 'favorites', true);
              deviceObj.favorites = true;
            } else {
              socket.emit4('setUserProperty', devId, 'favorites', false);
              deviceObj.favorites = false;
            }
          };
          setDeviceIcon(deviceObj);
          //  exports
          devicesDevCtrl.toggleDeviceFavorites = toggleDeviceFavorites;
          devicesDevCtrl.blacklistDevice = blacklistDevice;
          devicesDevCtrl.unblacklistDevice = unblacklistDevice;
          devicesDevCtrl.editDevice = editDevice;
          devicesDevCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = ctrl.deviceObj;
          // device in 'frame.devices' actions
          var blacklistBtn = elem[0].querySelector('.blacklist-btn');
          var unblacklistWrap = elem[0].querySelector('.device-blacklisted');
          var unblacklistBtn = unblacklistWrap.querySelector('button');
          var deleteBtn = elem[0].querySelector('.delete-btn');
          var favoritesBtn = elem[0].querySelector('.favorites-btn');
          // counter for delete button
          var doubleCheckDelete = 0;
          // if remote or camera, remove blacklist and display delete
          if (deviceObj.type != 'camera' && deviceObj.type != 'remote') {
            blacklistBtn.classList.remove('hidden');
          } else {
            deleteBtn.classList.remove('hidden');
          }
          // if device in favorites, change icon
          if (!deviceObj.favorites) {
            favoritesBtn.innerHTML = 'star_border';
          }
          /**
           * @name favoritesBtn
           * @desc change favorites icon
           * @type {event}
           */
          favoritesBtn.addEventListener('click', function() {
            if (!deviceObj.favorites) {
              this.innerHTML = 'star_border';
            } else {
              this.innerHTML = 'star';
            }
          }, false);
          /**
           * @name deleteBtn
           * @desc paint icon in red before delete
           * @type {event}
           */
          deleteBtn.addEventListener('click', function() {
            this.classList.add('double-check');
          }, false);
        }
      }
    }])
}());
