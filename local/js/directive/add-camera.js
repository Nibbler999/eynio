(function() {
  "use strict";

  angular
    .module('services')
    .directive('addCamera', ['$q', '$timeout', 'socket', 'dataService',
      function($q, $timeout, socket, dataService) {
        return {
          restrict: 'E',
          replace: true,
          templateUrl: 'html/directive/addCamera.html',
          controllerAs: 'addCameraCtrl',
          controller: ['$scope', function($scope) {

            var addCameraCtrl = this;

            // listen for request and display modal
            $scope.$on('addNewCamera', function(event) {
              addCameraCtrl.showModal = true;
            })

            /**
             * @name addNewCamera
             * @desc add nre camera
             * @type {function}
             * @param {camObj} camera object
             */
            function addNewCamera(camObj) {
              var defer = $q.defer();
              var testStream = camObj.rtsp ? camObj.rtsp : camObj.snapshot ? camObj.snapshot : camObj.mjpeg;
              console.log(testStream);
              socket.emit('testStreamURL', testStream, function(response) {
                defer.resolve(response);
                if (response) {
                  socket.emit('addCamera', camObj);
                }
              })
              return defer.promise
            }

            // exports
            addCameraCtrl.addNewCamera = addNewCamera;
          }],
          link: function(scope, elem, attr, ctrl) {

            // add camera DOM
            var modal = elem[0];
            var form = elem[0].querySelector('form');
            var cameraName = elem[0].querySelector('#add-camera-name');
            var cameraDesc = elem[0].querySelector('#add-camera-desc');
            var cameraUser = elem[0].querySelector('#add-camera-user');
            var cameraPass = elem[0].querySelector('#add-camera-password');
            var cameraFps = elem[0].querySelector('#add-camera-fps');
            var cameraRtsp = elem[0].querySelector('#add-camera-rtsp');
            var cameraMjpeg = elem[0].querySelector('#add-camera-mjpeg');
            var cameraSnap = elem[0].querySelector('#add-camera-snapshot');
            var cameraRot = elem[0].querySelector('#add-camera-rotation');
            var closeBtn = elem[0].querySelector('button[type="reset"]');

            /**
             * @name form
             * @desc collect data and submit for creating new camera
             * @type {event}
             */
            form.addEventListener('submit', function() {
                var camObj = {
                  server: JSON.parse(sessionStorage.activeServer).id,
                  name: cameraName.value,
                  category: null,
                  description: cameraDesc.value,
                  mjpeg: cameraMjpeg.value,
                  snapshot: cameraSnap.value,
                  rtsp: cameraRtsp.value,
                  auth_name: cameraUser.value,
                  auth_pass: cameraPass.value,
                  rotate: Number(cameraRot.value),
                  motion_alarm: false,
                  fps: Number(cameraFps.value)
                }
                ctrl.addNewCamera(camObj).then(function(response) {
                  console.log(response);
                  if (response) {
                    ctrl.addCamSuccess = 'yes';
                    $timeout(function() {
                      ctrl.addCamSuccess = null;
                      ctrl.showModal = false;
                      form.reset();
                    }, 1500)
                  } else {
                    ctrl.addCamSuccess = 'no';
                    $timeout(function() {
                      ctrl.addCamSuccess = null;
                      ctrl.showModal = false;
                    }, 1500)
                  }
                })
              }, false)
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
      }
    ])
}());
