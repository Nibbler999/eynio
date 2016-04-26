(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('RegisterCtrl', ['$state', '$stateParams', '$timeout', 'dataRequest', function($state, $stateParams, $timeout, dataRequest) {
      var register = this;

      // register input data
      var registerForm = document.querySelector('#register-form');
      var registerPassword = registerForm.querySelector('#register-password');
      var registerRePassword = registerForm.querySelector('#register-rePassword');
      var registerUsername = registerForm.querySelector('#register-username');
      var registerEmail = registerForm.querySelector('#register-email');
      // event, register user
      registerForm.addEventListener('submit', registerUser, false);

      /**
       * @name registerUser
       * @desc register user and redirect to login
       * @type {function}
       * @param {Event} event
       */
      function registerUser(e) {
        if (registerPassword.value === registerRePassword.value) {
          dataRequest.registerUser({
              user_name: registerUsername.value,
              email_address: registerEmail.value,
              password: registerPassword.value
            })
            .then(function(response) {

              if (response.data.errors) {
                angular.forEach(data.errors, function(error) {
                  alert(error);
                });
              } else if (response.data.success) {
                register.regSuccess = true;

                $timeout(function(){
                  $state.go('login', {
                      email: registerEmail.value
                  })
                }, 3500);
              }
            })
        } else {
          return false;
        }
      }
      // match repeat passwotd witch initial password
      registerRePassword.addEventListener('keyup', function(e) {
        if (this.value === registerPassword.value) {
          this.classList.remove('form-input-false');
          this.classList.add('form-input-true');
        } else {
          this.classList.add('form-input-false');
        }
      }, false);
    }])
}());
