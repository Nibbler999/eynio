(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DeviceCtrl', ['$scope', 'dataService', '$rootScope', 'socket',
      function($scope, dataService, $rootScope, socket) {

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

        device.editDevice = function(dev) {
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
          angular.forEach(device.asignedRooms, function(addRoom) {
            socket.emit('catAddDevice', addRoom.id, device.activeDevice.id);
            device.activeDevice.categories.push(addRoom.id);
          });
          angular.forEach(device.unAsignedRooms, function(removeRoom) {
            socket.emit('catDeleteDevice', removeRoom.id, device.activeDevice.id);
            angular.forEach(device.activeDevice.categories, function(cat) {
              if (cat === removeRoom.id) {
                device.activeDevice.categories
                  .splice(device.activeDevice.categories.indexOf(cat), 1);
              }
            })
          });
          socket.emit('setDeviceName', device.activeDevice.id, device.activeDevice.name);

          if (device.activeDevice.type === 'camera') {
            socket.emit('updateCamera', device.activeDevice);
          } else if (device.activeDevice.type === 'tv') {
            socket.emit('updateCustomRemote', device.activeDevice);
          }

          console.log(device.allLights);
        };

        device.deleteDevice = function() {
          if (device.activeDevice.type === 'tv') {
            socket.emit('deleteCustomRemote', device.activeDevice.id);
          } else if (device.activeDevice.type === 'camera') {
            socket.emit('deleteCamera', device.activeDevice.id);
          } else {
            socket.emit('blacklistDevice', device.activeDevice.id);
          }
        };
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

        /* add new camera */
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

        /* get data */
        var allDev = dataService.allDev();
        /* wait on socket to connect than get data */
        if (!allDev) {
          dataService.dataPending().then(function() {
            device.remotes = dataService.remotes();

            device.allLights = dataService.lights();
            device.allSwitches = dataService.switches();
            device.allThermos = dataService.thermostats();
            device.allShutters = dataService.shutters();
            device.allCustomRemotes = dataService.customRemotes();
            device.allCameras = dataService.cameras();
            device.allSensors = dataService.sensors();
          });
        } else {
          device.remotes = dataService.remotes();

          device.allLights = dataService.lights();
          device.allSwitches = dataService.switches();
          device.allThermos = dataService.thermostats();
          device.allShutters = dataService.shutters();
          device.allCustomRemotes = dataService.customRemotes();
          device.allCameras = dataService.cameras();
          device.allSensors = dataService.sensors();
        }
      }
    ])
}());
