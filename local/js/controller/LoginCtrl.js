(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('LoginCtrl', ['$state', '$stateParams', 'dataRequest', 'dataService', function($state, $stateParams, dataRequest, dataService) {

      var login = this;

      // check if URL contains email and pass and try login
      if ($stateParams.email && $stateParams.pass) {
        login.email = $stateParams.email;
        login.pass = $stateParams.pass;
        loginUser($stateParams.email, $stateParams.pass)
      }
      // if only email in URL filll the email input
      if ($stateParams.email && !$stateParams.pass) {
        login.email = $stateParams.email;
        login.pass = '';
      }
      // oauth2 gplus login
      if ($stateParams.oauth2) {
        dataRequest.oauth2().then(function(response) {
          console.log(response);
          resolveResponse(response);
        })
      }
      /**
       * @name loginUser
       * @desc authenticate user and log in
       * @type {function}
       * @param {email, pass) email, password}
       */
      function loginUser(email, pass) {
        dataRequest.authUser({
            email: email,
            pass: pass
          })
          .then(function(response) {
            response.data.email = email;
            resolveResponse(response);
          })
          .catch(function(response) {
            login.incorrect = response.status === 403 ? true : false;
            console.log(response);
          })
      }
      /**
       * @name resolveResponse
       * @desc redirect user and parameters
       * @type {function}
       * @param {response} server response
       */
      function resolveResponse(response) {
        console.log(response.data);

        sessionStorage.userInfoData = JSON.stringify(response.data);
        sessionStorage.activeServer = response.data.servers[0] ? JSON.stringify(response.data.servers[0]) : JSON.stringify({});

        if (response.data.servers.length) {
          $state.go('frame.dashboard', {
            lastRoute: 'login'
          });
        } else {
          $state.go('frame.add-server');
        }
      }

      // exports
      login.loginUser = loginUser;

      //check for service worker and implement it
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('serviceWorker.js')
          .then(navigator.serviceWorker.ready)
          .then(function(reg) {
            reg.pushManager.subscribe({
                userVisibleOnly: true
              })
              .then(function(sub) {
                if (sub.endpoint) {
                  sessionStorage.GCMReg = sub.endpoint.slice(40);
                }
              });
          })
          .catch(function(err) {
            console.log(err);
          })
      }
    }]);
}());
