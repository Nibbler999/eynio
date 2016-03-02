(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DeviceCtrl', ['$scope', 'dataService', '$rootScope', 'socket', '$timeout', '$stateParams',
      function($scope, dataService, $rootScope, socket, $timeout, $stateParams) {

        var device = this;

        /* add/remove/check category */
        var customModal = document.querySelectorAll('.custom-modal-window');
        var editDevicesModal = document.querySelector('.edit-device-modal');
        var addCameraModal = document.querySelector('.add-camera-modal');
        var addRemoteModal = document.querySelector('.add-remote-modal');

        /* add new remote */
        var addRemName = document.getElementById('add-remote-name');
        var addRemIR = document.getElementById('add-remote-ir-output');
        var addRemType = document.getElementsByName('add-remote-type');
        var addRemBridge = document.getElementsByName('add-remote-bridge');

        /* add new camera*/
        var addCamName = document.getElementById('add-camera-name');
        var addCamDesc = document.getElementById('add-camera-desc');
        var addCamUser = document.getElementById('add-camera-user');
        var addCamPass = document.getElementById('add-camera-password');
        var addCamRTPS = document.getElementById('add-camera-rtsp');
        var addCamMJPEG = document.getElementById('add-camera-mjpeg');
        var addCamSnapshot = document.getElementById('add-camera-snapshot');
        var addCamRotation = document.getElementById('add-camera-rotation');
        var addCameraFps = document.getElementById('add-camera-fps');
        var addCamStep1 = document.querySelector('.add-camera-step-1');
        var addCamStep2 = document.querySelector('.add-camera-step-2');

        var contentWrapParent = document.querySelector('.frame-page-content-wrap');
        // var displayRow = document.getElementsByClassName('display-dev-row');
        var allCategories;

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

        // rootScope from device to devicesCtrl and open modal
        $scope.$on('editDevice', function(event, data) {
          editDevice(data);
        });

        function editDevice(dev) {
          console.log(dev);
          device.activeDevice = dev;

          device.asignedRooms = [];
          device.unAsignedRooms = [];

          angular.forEach(allCategories, function(allCat) {
            if (dev.category === allCat.id) {
              device.asignedRooms.push(allCat);
            } else {
              device.unAsignedRooms.push(allCat);
            }
          });
          editDevicesModal.style.display = 'block';
        };
        device.addRoom = function(index, room) {
          device.unAsignedRooms.splice(index, 1);
          if (device.asignedRooms[0]) {
            device.unAsignedRooms.push(device.asignedRooms[0]);
          }
          device.asignedRooms = [];
          device.asignedRooms.push(room);
        };
        device.removeRoom = function(index, room) {
          device.asignedRooms.splice(index, 1);
          device.unAsignedRooms.push(room);
        };

        device.saveDeviceOptions = function() {
          // remove all categories
          device.activeDevice.categories = [];
          device.activeDevice.category = null;
          // add categories
          angular.forEach(device.asignedRooms, function(addRoom) {
            socket.emit('catSet', addRoom.id, device.activeDevice.id);
            device.activeDevice.category = addRoom.id;
          });
          //remove categories
          angular.forEach(device.unAsignedRooms, function(removeRoom) {
            socket.emit('catDeleteDevice', removeRoom.id, device.activeDevice.id);
          });
          //  change name
          socket.emit('setDeviceName', device.activeDevice.id, device.activeDevice.name);
          // update if camera or remote
          if (device.activeDevice.type === 'camera') {
            device.activeDevice.rotate = Number(device.activeDevice.rotate);
            device.activeDevice.fps = Number(device.activeDevice.fps);
            socket.emit('updateCamera', device.activeDevice);
          } else if (device.activeDevice.type === 'tv') {
            socket.emit('updateCustomRemote', device.activeDevice);
          }
        };

        /* show add remote modal */
        device.addRemote = function() {
          addRemoteModal.style.display = 'block';
        };

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
            category: null,
            type: 'remote',
            subtype: remType,
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

        device.addNewCamera = function() {

          var cam = {
            server: JSON.parse(sessionStorage.activeServer).id,
            name: addCamName.value,
            category: null,
            description: addCamDesc.value,
            mjpeg: addCamMJPEG.value,
            snapshot: addCamSnapshot.value,
            rtsp: addCamRTPS.value,
            auth_name: addCamUser.value,
            auth_pass: addCamPass.value,
            rotate: Number(addCamRotation.value),
            motion_alarm: false,
            fps: Number(addCameraFps.value)
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

        $scope.$on('closeModals', function(event) {
          contentWrapParent.removeChild(addCameraModal);
          contentWrapParent.removeChild(addRemoteModal);
          contentWrapParent.removeChild(editDevicesModal);
        });

        /* get data */
        device.data = dataService.getData();

        if (device.data.getDevicesObj) {
          if ($stateParams.deviceType) {
            $timeout(function() {
              document.querySelector('#sensors-list').classList.add('in');
            }, 100);
          } else {
            // show first set of devices
            $timeout(function() {
              contentWrapParent.children[0].children[1].children[1].classList.add('in');
            }, 100);
          }
        }
        /* wait on socket to connect than get data */
        if (!device.data.getDevicesObj || !device.data.getBlacklisted) {
          dataService.getDevicesEmit().then(function(devices) {
            device.data.getDevicesObj = devices;
            console.log(devices);
            $timeout(function() {
              contentWrapParent.children[0].children[1].children[1].classList.add('in');
            }, 100);
          });
          dataService.getServerEmits().then(function(){
            device.data = dataService.getData();
          });
          dataService.getCategoriesEmit();
          dataService.getScenesEmit();
          dataService.getSchedulesEmit();
          dataService.getRecordingsEmit();
        }
      }
    ])
}());
