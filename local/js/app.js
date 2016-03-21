(function() {
  "use strict";

  angular
    .module('nHome', ['ui.router', 'services'])
    .config(['$stateProvider', '$urlRouterProvider', '$compileProvider', function($stateProvider, $urlRouterProvider, $compileProvider) {
      $compileProvider.debugInfoEnabled(false);
      $urlRouterProvider
        .when('', 'dashboard');
      $stateProvider
        .state('login', {
          url: '/login?email&pass&oauth2',
          templateUrl: 'html/login_template.html',
          controller: 'LoginCtrl',
          controllerAs: 'login'
        })
        .state('register', {
          url: '/register',
          templateUrl: 'html/register_template.html',
          controller: 'RegisterCtrl',
          controllerAs: 'register'
        })
        .state('password', {
          url: '/forgot-password',
          templateUrl: 'html/forgot_password_template.html',
          controller: 'ForgotPassCtrl',
          controllerAs: 'pass'
        })
        .state('frame', {
          templateUrl: 'html/frame_template.html',
          controller: 'NHomeCtrl',
          controllerAs: 'God'
        })
        .state('frame.add-server', {
          url: '/add-server',
          templateUrl: 'html/add_server_template.html',
          controller: 'AddServer',
          controllerAs: 'addServer'
        })
        .state('frame.devices', {
          url: '/devices',
          templateUrl: 'html/devices_template.html',
          controller: 'DeviceCtrl',
          controllerAs: 'device',
          params: {
            deviceType: {
              value: undefined
            }
          }
        })
        .state('frame.scenes', {
          url: '/scenes',
          templateUrl: 'html/scenes_template.html',
          controller: 'ScenesCtrl',
          controllerAs: 'scene'
        })
        .state('frame.security', {
          url: '/security',
          templateUrl: 'html/security_template.html',
          controller: 'SecurityCtrl',
          controllerAs: 'security'
        })
        .state('frame.schedule', {
          url: '/schedule',
          templateUrl: 'html/schedule_template.html',
          controller: 'ScheduleCtrl',
          controllerAs: 'schedule'
        })
        .state('frame.server-settings', {
          url: '/server',
          templateUrl: 'html/settings/server_template.html ',
          controller: 'SettingsServerCtrl',
          controllerAs: 'server'
        })
        .state('frame.account-settings', {
          url: '/account',
          templateUrl: 'html/settings/account_template.html',
          controller: 'SettingsAccountCtrl',
          controllerAs: 'acc'
        })
        .state('frame.all-rooms', {
          url: '/all-rooms',
          templateUrl: 'html/all_rooms_template.html',
          controller: 'AllRoomsCtrl',
          controllerAs: 'allRooms'
        })
        .state('frame.dashboard', {
          url: '/dashboard',
          templateUrl: 'html/dashboard_template.html',
          controller: 'DashboardCtrl',
          controllerAs: 'dashboard',
          params: {
            lastRoute: {
              value: undefined
            }
          }
        })
        .state('frame.most-used', {
          url: '/most-used',
          templateUrl: 'html/most_used_template.html',
          controller: 'MostUsedCtrl',
          controllerAs: 'mostUsed'
        })
        .state('frame.recently-used', {
          url: '/recently-used',
          templateUrl: 'html/recently_used_template.html',
          controller: 'RecentlyUsedCtrl',
          controllerAs: 'recently'
        })
    }]);
}());
