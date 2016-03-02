(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('RecentlyUsedCtrl', ['dataService', function(dataService) {

      var recently = this;

      /* get data */
      recently.data = dataService.getData();

      if (recently.data.getDevicesArray) {

        recently.allDevArray = recently.data.getDevicesArray.filter(function(dev) {
          return dev.lastused
        }).sort(function(a, b) {
          return Date.parse(b.lastused) - Date.parse(a.lastused)
        });
      } else {
        dataService.getDevicesEmit().then(function(devices) {
          recently.data = dataService.getData();
          recently.allDevArray = recently.data.getDevicesArray.filter(function(dev) {
            return dev.lastused
          }).sort(function(a, b) {
            return Date.parse(b.lastused) - Date.parse(a.lastused)
          });
        });
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
        dataService.getServerEmits();
      }
    }]);
}());
