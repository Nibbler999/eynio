(function() {
  'use strict';

  angular
    .module('nHome')
    .directive('addScanCamera', ['$q', '$timeout', 'socket', function($q, $timeout, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/addScanCamera.html',
        controllerAs: 'addScanCameraCtrl',
        controller: ['$scope', function($scope) {

          var addScanCameraCtrl = this;
          var scanedCameras;
          var i = 0;

          addScanCameraCtrl.scaning = true;

          $scope.$on('addScanedCameraScan', function(event){
            addScanCameraCtrl.showModal = true;
          })

          // listen for request and display modal
          $scope.$on('addScanedCamera', function(event, data) {
            console.log(data);
            scanedCameras = data;
            addScanCameraCtrl.activeCam = data[0];
            addScanCameraCtrl.scaning = false;
          });

          /**
           * @name addScanCameraSubmit
           * @desc take username and pass from form and pass to add cameras
           * @type {event}
           */
          function addScanCameraSubmit() {
            if (addScanCameraCtrl.useDataForAll) {
              angular.forEach(scanedCameras, function(cam) {
                socket.emit4('scanCamera', cam, addScanCameraCtrl.addScanCamUser, addScanCameraCtrl.addScanCamPass, function(response) {
                  if (response) {
                    socket.emit('addCamera', response);
                  }
                });
              })
              addScanCameraCtrl.showModal = false;
              return
            }
            socket.emit4('scanCamera', scanedCameras[i], addScanCameraCtrl.addScanCamUser, addScanCameraCtrl.addScanCamPass, function(response) {
              socket.emit('addCamera', response);
              i++;
              addScanCameraCtrl.addScanCamUser = '';
              addScanCameraCtrl.addScanCamPass = '';
            });

            if (i === scanedCameras.length - 1) {
              addScanCameraCtrl.showModal = false;
              return
            }
            addScanCameraCtrl.activeCam = data[i];
          }

          // exports
          addScanCameraCtrl.addScanCameraSubmit = addScanCameraSubmit;

        }],
        link: function(scope, elem, attr, ctrl) {
          // add camera DOM
          var modal = elem[0];
          var form = elem[0].querySelector('form');
          var closeBtn = elem[0].querySelector('button[type="reset"]');

          /**
           * @name closeBtn
           * @desc close modal with popUp effect
           * @type {event}
           */
          closeBtn.addEventListener('click', function() {
            modal.style.animation = 'popDown 0.25s ease';

            $timeout(function() {
              ctrl.showModal = false;
              modal.style.animation = 'none';
              form.reset();
            }, 235)
          }, false);

          // listen for state change and close modal
          scope.$on('closeModals', function(event) {
            closeBtn.click();
          });
        }
      }
    }])
}());
