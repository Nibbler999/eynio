(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ScenesCtrl', ['dataService', function(dataService) {

      var scene = this;
      // get data
      scene.data = dataService.getData();

      // if no scenes, request from server
      if (!scene.data.getScenes) {
        dataService.getScenesEmit().then(function(scenes) {
          scene.data.getScenes = scenes;
        })
        dataService.getServerEmits();
        dataService.getCategoriesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
      }
    }]);
}());
