(function() {
  "use strict";

  angular
    .module('services')
    .directive('editDevice', ['$q', '$timeout', 'socket', 'dataService', function($q, $timeout, socket, dataService) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/editDevice.html',
        controllerAs: 'editDeviceCtrl',
        controller: ['$scope', function($scope) {

          var editDeviceCtrl = this;
          var deviceObj;
          var data = dataService.getData();
          var allCategories = data.getCategories ? data.getCategories : null;

          // init device categories
          editDeviceCtrl.asignedRooms = [];
          editDeviceCtrl.unAsignedRooms = [];
          // listen for emit from device, show modal and fill with data
          $scope.$on('editDevice', function(event, data) {
            editDeviceCtrl.deviceObj = data;
            editDeviceCtrl.showModal = true;
            if (!allCategories) {
              data = dataService.getData();
              allCategories = data.getCategories;
            }
            // loop categories, sort by device
            angular.forEach(allCategories, function(roomObj) {
              if (editDeviceCtrl.deviceObj.category === roomObj.id) {
                editDeviceCtrl.asignedRooms.push(roomObj);
              } else {
                editDeviceCtrl.unAsignedRooms.push(roomObj);
              }
            });
          });
          /**
           * @name addDeviceRoom
           * @desc add room to device
           * @type {function}
           * @param {index, roomObj} room index in array, room object
           */
          function addDeviceRoom(index, roomObj) {
            editDeviceCtrl.unAsignedRooms.splice(index, 1);
            if (editDeviceCtrl.asignedRooms[0]) {
              editDeviceCtrl.unAsignedRooms.push(editDeviceCtrl.asignedRooms[0]);
            }
            editDeviceCtrl.asignedRooms = [];
            editDeviceCtrl.asignedRooms.push(roomObj);
          };
          /**
           * @name removeDeviceRoom
           * @desc remove room from device.category
           * @type {function}
           * @param {index, roomObj} index in asignes array, room objext
           */
          function removeDeviceRoom(index, roomObj) {
            editDeviceCtrl.asignedRooms.splice(index, 1);
            editDeviceCtrl.unAsignedRooms.push(roomObj);
          };
          /**
           * @name closeDeviceEditModal
           * @desc close modal, restore data
           * @type {function}
           */
          function closeDeviceEditModal() {
            editDeviceCtrl.asignedRooms = [];
            editDeviceCtrl.unAsignedRooms = [];
            editDeviceCtrl.deviceObj = null;
            editDeviceCtrl.showModal = false;
          }
          /**
           * @name saveDeviceEdit
           * @desc save edited
           * @type {function}
           * @param {param}
           */
          function saveDeviceEdit(devObj) {
            // remove all categories
            devObj.categories = [];
            devObj.category = editDeviceCtrl.asignedRooms[0] ? editDeviceCtrl.asignedRooms[0].id :
              null;
            // set category if any
            socket.emit('catSet', devObj.category, devObj.id);
            // remove categories
            angular.forEach(editDeviceCtrl.unAsignedRooms, function(removeRoom) {
              socket.emit('catDeleteDevice', removeRoom.id, devObj.id);
            });
            // change name
            socket.emit('setDeviceName', devObj.id, devObj.name);
            // update if camera or remote
            if (devObj.type === 'camera') {
              devObj.rotate = Number(devObj.rotate);
              devObj.fps = Number(devObj.fps);
              socket.emit('updateCamera', devObj);
            } else if (devObj.type === 'remote') {
              socket.emit('updateCustomRemote', devObj);
            }
            closeDeviceEditModal();
          }
          // exports
          editDeviceCtrl.addDeviceRoom = addDeviceRoom;
          editDeviceCtrl.removeDeviceRoom = removeDeviceRoom;
          editDeviceCtrl.saveDeviceEdit = saveDeviceEdit;
          editDeviceCtrl.closeDeviceEditModal = closeDeviceEditModal;
        }],
        link: function(scope, elem, attr, ctrl) {

          var closeBtn = elem[0].querySelector('.edit-devices-close-btn');
          var cancelBtn = elem[0].querySelector('.orange-btn');

          /**
           * @name closeBtn
           * @desc close modal on click
           * @type {event}
           */
          closeBtn.addEventListener('click', function() {
            ctrl.closeDeviceEditModal();
            scope.$apply();
          }, false);
          /**
           * @name cancelBtn
           * @desc close modal on cancel btn
           * @type {event}
           */
          cancelBtn.addEventListener('click', function() {
            ctrl.closeDeviceEditModal();
            scope.$apply();
          }, false);
          /**
           * @name document.body
           * @desc close modal on 'ESC'
           * @type {event}
           */
          document.body.addEventListener('keydown', function(e) {
            if (e.keyCode === 27) {
              closeBtn.click();
            }
          }, false);
          // listen for state change and close modal
          scope.$on('closeModals', function(event) {
            closeBtn.click();
          });
        }
      }
    }])
}());
