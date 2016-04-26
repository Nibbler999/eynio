(function() {
  "use strict";

  angular
    .module('services')
    .directive('addRemote', ['$q', '$timeout', 'socket', 'dataService', function($q, $timeout, socket, dataService) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/addRemote.html',
        controllerAs: 'addRemoteCtrl',
        controller: ['$scope', function($scope) {

          var addRemoteCtrl = this;

          // listen for add remote request
          $scope.$on('addNewRemote', function(event) {
            addRemoteCtrl.data = dataService.getData();
            addRemoteCtrl.showModal = true;
          });
          /**
           * @name addNewRemote
           * @desc add new remote
           * @type {function}
           * @param {remObj} remote object with new params
           */
          function addNewRemote(remObj) {
            var defer = $q.defer();
            socket.emit('saveCustomRemote', remObj, function(response) {
              defer.resolve(response);
            });
            return defer.promise
          }

          // exports
          addRemoteCtrl.addNewRemote = addNewRemote;
        }],
        link: function(scope, elem, attr, ctrl) {

          // add remote DOM
          var modal = elem[0];
          var form = elem[0].querySelector('form');
          var remoteName = elem[0].querySelector('#add-remote-name');
          var remoteIR = form.querySelector('#add-remote-ir-output');
          var remoteType = form.querySelectorAll('[name=add-remote-type]');
          var remoteBridge = form.querySelectorAll('[name=add-remote-bridge]');
          var closeBtn = elem[0].querySelector('button[type="reset"]');
          /**
           * @name form
           * @desc submit form, create new remote
           * @type {event}
           */
          form.addEventListener('submit', function() {
            if(!remoteBridge.length){
              remoteBridge = form.querySelectorAll('[name=add-remote-bridge]');
            }

              var ir, type, bridge, remote;
              // loop remote types, select checked one
              angular.forEach(remoteType, function(typ) {
                if (typ.checked) {
                  type = typ.value;
                }
              });
              // loop nHome bridges, select checked one
              angular.forEach(remoteBridge, function(nhb) {
                if (nhb.checked) {
                  bridge = nhb.value;
                }
              });
              // fill remtoe object with input data
              remote = {
                  name: remoteName.value,
                  keys: [],
                  category: null,
                  type: 'remote',
                  subtype: type,
                  deviceid: bridge
                }
                // wait for request response than close modal
              ctrl.addNewRemote(remote).then(function(response) {
                if (response) {
                  modal.style.animation = 'popDown 0.25s ease';

                  $timeout(function() {
                    ctrl.showModal = false;
                    form.reset();
                    modal.style.animation = 'none';
                  }, 250)
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
              form.reset();
              modal.style.animation = 'none';
            }, 250)
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
