(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DeviceCtrl', ['$scope', 'dataService', '$rootScope', 'socket', '$timeout',
      function($scope, dataService, $rootScope, socket, $timeout) {

        var device = this;

        /* add/remove/check category */
        var customModal = document.querySelectorAll('.custom-modal-window');
        var editDevicesModal = document.querySelector('.edit-device-modal');
        var addCameraModal = document.querySelector('.add-camera-modal');
        var addRemoteModal = document.querySelector('.add-remote-modal');

        var contentWrapParent = document.querySelector('.frame-page-content-wrap');
        var displayRow = document.getElementsByClassName('display-dev-row');
        var selectedDev, allCategories;

        contentWrapParent.appendChild(addCameraModal);
        contentWrapParent.appendChild(addRemoteModal);
        contentWrapParent.appendChild(editDevicesModal);

        socket.emit('getCategories', null, function(categories) {
          allCategories = categories;
        });

        /* close button */
        device.closeCustomModal = function() {
          for (var i = 0; i < customModal.length; i++) {
            customModal[i].style.display = 'none';
          }
        };

        // rootScope from device to devices ctr and open modal
        $scope.$on('editDevice', function(event, data) {
          editDevice(data);
        });

        function editDevice(dev) {
          console.log(dev);
          device.activeDevice = dev;

          device.asignedRooms = [];
          device.unAsignedRooms = [];

          angular.forEach(allCategories, function(allCat) {
            if (dev.categories.indexOf(allCat.id) !== -1) {
              device.asignedRooms.push(allCat);
            } else {
              device.unAsignedRooms.push(allCat);
            }
          });
          editDevicesModal.style.display = 'block';
        };
        device.addRoom = function(index, room) {
          device.unAsignedRooms.splice(index, 1);
          device.asignedRooms.push(room);
        };
        device.removeRoom = function(index, room) {
          device.asignedRooms.splice(index, 1);
          device.unAsignedRooms.push(room);
        };

        device.saveDeviceOptions = function() {
          // remove all categories
          device.activeDevice.categories = [];
          // add categories
          angular.forEach(device.asignedRooms, function(addRoom) {
            socket.emit('catAddDevice', addRoom.id, device.activeDevice.id);
            device.activeDevice.categories.push(addRoom.id);
          });
          //remove categories
          angular.forEach(device.unAsignedRooms, function(removeRoom) {
            socket.emit('catDeleteDevice', removeRoom.id, device.activeDevice.id);
          });
          //  change name
          socket.emit('setDeviceName', device.activeDevice.id, device.activeDevice.name);
          //add to favorites
          if (device.activeDevice.favorites) {
            socket.emit4('setUserProperty', device.activeDevice.id, 'favorites', true);
          } else {
            socket.emit4('setUserProperty', device.activeDevice.id, 'favorites', false);
          }
          // update if camera or remote
          if (device.activeDevice.type === 'camera') {
            socket.emit('updateCamera', device.activeDevice);
          } else if (device.activeDevice.type === 'tv') {
            socket.emit('updateCustomRemote', device.activeDevice);
          }
        };

        /* show add remote modal */
        device.addRemote = function() {
          addRemoteModal.style.display = 'block';
        };
        /* add new remote */
        var addRemName = document.getElementById('add-remote-name');
        var addRemIR = document.getElementById('add-remote-ir-output');
        var addRemType = document.getElementsByName('add-remote-type');
        var addRemBridge = document.getElementsByName('add-remote-bridge');

        device.addNewRemote = function() {
          var remType, bridgeType, remote;
          angular.forEach(addRemType, function(type) {
            if (type.checked) {
              remType = type.value;
            }
          });
          angular.forEach(addRemBridge, function(bridge) {
            if (bridge.checked) {
              bridgeType = bridge.value;
            }
          });

          remote = {
            name: addRemName.value,
            keys: [],
            type: remType,
            deviceid: bridgeType
          };
          socket.emit('saveCustomRemote', remote, function(newRemote) {
            if (newRemote) {
              document.querySelector('.add-remote-wrap').style.animation = 'popDown 0.25s ease';
              setTimeout(function() {
                device.closeCustomModal();
                addRemName.value = '';
                angular.forEach(addRemType, function(type) {
                  type.checked = true;
                });
                angular.forEach(addRemBridge, function(bridge) {
                  bridge.checked = true;
                })
                document.querySelector('.add-remote-wrap').style.animation = 'none';
              }, 250);
            }
          });
        };

        /* add new camera modal */
        device.addCamera = function() {
          addCameraModal.style.display = 'block';
        };
        var addCamName = document.getElementById('add-camera-name');
        var addCamDesc = document.getElementById('add-camera-desc');
        var addCamUser = document.getElementById('add-camera-user');
        var addCamPass = document.getElementById('add-camera-password');
        var addCamRTPS = document.getElementById('add-camera-rtsp');
        var addCamMJPEG = document.getElementById('add-camera-mjpeg');
        var addCamSnapshot = document.getElementById('add-camera-snapshot');

        var addCamStep1 = document.querySelector('.add-camera-step-1');
        var addCamStep2 = document.querySelector('.add-camera-step-2');

        device.addNewCamera = function() {
          var cam = {
            server: sessionStorage.activeServerId,
            name: addCamName.value,
            description: addCamDesc.value,
            mjpeg: addCamMJPEG.value,
            snapshot: addCamSnapshot.value,
            rtsp: addCamRTPS.value,
            auth_name: addCamUser.value,
            auth_pass: addCamPass.value
          }

          addCamStep1.style.display = 'none';
          addCamStep2.style.display = 'block';

          if (addCamRTPS.value) {
            socket.emit('testStreamURL', addCamRTPS.value, function(stream) {
              if (stream) {
                device.addCamSuccess = true;
                socket.emit('addCamera', cam);
              } else {
                device.addCamSuccess = false;
              }
            })
          } else if (addCamMJPEG.value) {
            socket.emit('testStreamURL', addCamMJPEG.value, function(stream) {
              if (stream) {
                device.addCamSuccess = true;
                socket.emit('addCamera', cam);
              } else {
                device.addCamSuccess = false;
              }
            })
          } else if (addCamSnapshot.value) {
            socket.emit('testStreamURL', addCamSnapshot.value, function(stream) {
              if (stream) {
                device.addCamSuccess = true;
                socket.emit('addCamera', cam);
              } else {
                device.addCamSuccess = false;
              }
            })
          }
        };
        device.restoreAddCamModal = function() {
          if (device.addCamSuccess) {
            addCamName.value = '';
            addCamDesc.value = '';
            addCamMJPEG.value = '';
            addCamSnapshot.value = '';
            addCamRTPS.value = '';
            addCamUser.value = '';
            addCamPass.value = '';

            device.addCamSuccess = undefined;
            addCamStep1.style.display = 'block';
            addCamStep2.style.display = 'none';
          } else {
            device.addCamSuccess = undefined;
            addCamStep1.style.display = 'block';
            addCamStep2.style.display = 'none';
          }
        };


        // close modals on ESC
        document.body.onkeyup = function(e) {
          if (e.keyCode === 27) {
            device.closeCustomModal();
          }
        };

        /* remove active room class */
        $rootScope.$on('$stateChangeSuccess', function(ev, to, toParams, from, fromParams) {
          device.closeCustomModal();
        });

        /* get data */
        device.allDev = dataService.allDev();
        device.allRemotes = dataService.allCustomRemotes();

        device.bridges = dataService.bridges();
        //
        // device.allLights = dataService.sortDevicesByType(device.allDev, 'light');
        // device.allSwitches = dataService.sortDevicesByType(device.allDev, 'switch');
        // device.allThermos = dataService.sortDevicesByType(device.allDev, 'thermostat');
        // device.allShutters = dataService.sortDevicesByType(device.allDev, 'shutter');
        // device.allCameras = dataService.sortDevicesByType(device.allDev, 'camera');
        // device.allSensors = dataService.sortDevicesByType(device.allDev, 'sensor');

        // device.allTvRemotes = dataService.sortRemotesByType(allRemotes, 'tv');

        device.allBlacklistedDev = dataService.allBlacklistedDev();
        if (device.allDev) {
          // show first set of devices
          $timeout(function() {
            contentWrapParent.children[0].children[1].children[1].classList.add('in');
          }, 100);
        }
        /* wait on socket to connect than get data */
        if (!device.allDev) {
          dataService.dataPending().then(function() {
            device.bridges = dataService.bridges();

            device.allDev = dataService.allDev();
            device.allRemotes = dataService.allCustomRemotes();
            //
            // device.allLights = dataService.sortDevicesByType(device.allDev, 'light');
            // device.allSwitches = dataService.sortDevicesByType(device.allDev, 'switch');
            // device.allThermos = dataService.sortDevicesByType(device.allDev, 'thermostat');
            // device.allShutters = dataService.sortDevicesByType(device.allDev, 'shutter');
            // device.allCameras = dataService.sortDevicesByType(device.allDev, 'camera');
            // device.allSensors = dataService.sortDevicesByType(device.allDev, 'sensor');

            //device.allTvRemotes = dataService.sortRemotesByType(allRemotes, 'tv');

            device.allBlacklistedDev = dataService.allBlacklistedDev();
            //show first set of devics
            $timeout(function() {
              contentWrapParent.children[0].children[1].children[1].classList.add('in');
            }, 100);
          });
        }
      }
    ])
}());
