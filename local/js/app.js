(function() {
  "use strict";

  angular
    .module('nHome', ['ui.router', 'services'])
    .config(function($stateProvider, $urlRouterProvider) {
      $urlRouterProvider
        .when('', 'all-rooms');
      $stateProvider
        .state('login', {
          url: '/login',
          templateUrl: 'html_route/login_template.html',
          controller: 'LoginCtrl',
          controllerAs: 'login'
        })
        .state('frame', {
          templateUrl: 'html_route/frame_template.html',
          controller: 'NHomeCtrl',
          controllerAs: 'God'
        })
        .state('frame.add-server', {
          url: '/add-server',
          templateUrl: 'html_route/addServer_template.html',
          controller: 'AddServer',
          controllerAs: 'addServer'
        })
        .state('frame.devices', {
          url: '/devices',
          templateUrl: 'html_route/devices_template.html',
          controller: 'DeviceCtrl',
          controllerAs: 'device'
        })
        .state('frame.scenes', {
          url: '/scenes',
          templateUrl: 'html_route/scenes_template.html',
          controller: 'ScenesCtrl',
          controllerAs: 'scene'
        })
        .state('frame.security', {
          url: '/security',
          templateUrl: 'html_route/security_template.html',
          controller: 'SecurityCtrl',
          controllerAs: 'security'
        })
        .state('frame.schedule', {
          url: '/schedule',
          templateUrl: 'html_route/schedule_template.html',
          controller: 'ScheduleCtrl',
          controllerAs: 'schedule'
        })
        .state('frame.server-settings', {
          url: '/server',
          templateUrl: 'html_route/settings/server_template.html ',
          controller: 'SettingsServerCtrl',
          controllerAs: 'server'
        })
        .state('frame.account-settings', {
          url: '/account',
          templateUrl: 'html_route/settings/account_template.html',
          controller: 'SettingsAccountCtrl',
          controllerAs: 'acc'
        })
        .state('frame.all-rooms', {
          url: '/all-rooms',
          templateUrl: 'html_route/all_rooms_template.html',
          controller: 'AllRoomsCtrl',
          controllerAs: 'allRooms'
        })
        .state('frame.favorites', {
          url: '/favorites',
          templateUrl: 'html_route/favorites_template.html',
          controller: 'FavoritesCtrl',
          controllerAs: 'favorites'
        })
        .state('frame.most-used',{
          url: '/most-used',
          templateUrl: 'html_route/most_used_template.html',
          controller: 'MostUsedCtrl',
          controllerAs: 'mostUsed'
        })
        .state('frame.recently-used',{
          url: '/recently-used',
          templateUrl: 'html_route/recently_used_template.html',
          controller: 'RecentlyUsedCtrl',
          controllerAs: 'recently'
        })
    });
}());
