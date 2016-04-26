(function() {
  "use strict";

  angular
    .module('services')
    .factory('dataRequest', ['$http', function($http) {

      var url = 'https://nhome.ba/api/';
      var auth = 'auth';
      var register = 'register';
      var logout = 'logout';
      var resetPass = 'reset_password';
      var getServers = 'get_servers';
      var claimServer = 'claim_server';
      var uploadAvatar = 'upload_avatar';
      var session = 'session';

      return {
        authUser: function(authUserData) {
          return $http.post(url + auth, authUserData, {
            withCredentials: true
          });
        },
        logout: function() {
          return $http.post(url + logout, {}, {
            withCredentials: true
          });
        },
        registerUser: function(newUserData) {
          return $http.post(url + register, newUserData, {
            withCredentials: true
          });
        },
        passReset: function(userEmail) {
          return $http.post(url + resetPass, userEmail, {
            withCredentials: true
          });
        },
        getServers: function() {
          return $http.post(url + getServers, {}, {
            withCredentials: true
          });
        },
        claimServer: function(serverId) {
          return $http.post(url + claimServer + '/' + serverId, {}, {
            withCredentials: true
          });
        },
        uploadAvatar: function(avatar) {
          return $http.post(url + uploadAvatar, avatar, {
            withCredentials: true,
            headers: {
              'Content-Type': undefined
            },
            transformRequest: angular.identity
          });
        },
        oauth2: function(){
          return $http.post(url + session, {}, {
            withCredentials: true
          });
        }
      }
    }]);
}());
