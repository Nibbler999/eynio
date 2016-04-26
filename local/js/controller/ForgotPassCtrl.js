(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ForgotPassCtrl', ['$state', '$stateParams', '$timeout', 'dataRequest', function($state, $stateParams, $timeout, dataRequest) {

      var pass = this;

      // input data
      var forgotPassForm = document.querySelector('#forgot-pass');
      var forgotPassEmail = forgotPassForm.querySelector('#reset-email');

      // event - reseting password
      forgotPassForm.addEventListener('submit', resetPass, false);

      /**
       * @name resetPass
       * @desc reset user password
       * @type {Functon}
       * @param {Ecent} e
       */
      function resetPass(e) {
        dataRequest
          .passReset({
            email_address: forgotPassEmail.value
          })
          .then(function(response) {

            pass.passReset = response.data;
            if (response.data) {
              // forgotPassEmail.value = '';
              $timeout(function() {
                $state.go('login', {
                  email: forgotPassEmail.value
                });
              }, 3500);
            }
          })
      }
    }])
}());
