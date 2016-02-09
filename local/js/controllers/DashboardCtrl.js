(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DashboardCtrl', ['dataService', function(dataService) {

      var dashboard = this;

      /* get data */
      dashboard.data = dataService.getData();

      if (dashboard.data.getDevicesArray && dashboard.data.getRecordings) {

        dashboard.uncategorised = dashboard.data.getDevicesArray.filter(function(dev) {
          return dev.category === null
        });
        console.log(dashboard.uncategorised);

        dashboard.allDevArray = dashboard.data.getDevicesArray.filter(function(dev) {
          return dev.lastused
        }).sort(function(a, b) {
          return Date.parse(b.lastused) - Date.parse(a.lastused)
        });

        dashboard.getScenes = dashboard.data.getScenes ? dashboard.data.getScenes.slice(0, 5) : [];
        dashboard.getSchedules = dashboard.data.getSchedules ? dashboard.data.getSchedules.slice(0, 5) : [];
        dashboard.getRecordings = dashboard.data.getRecordings ? dashboard.data.getRecordings.slice(0, 5) : [];
      } else {
        dataService.getDevicesEmit().then(function(devices) {
          dashboard.data = dataService.getData();

          dashboard.uncategorised = dashboard.data.getDevicesArray.filter(function(dev) {
            return dev.category === null
          });

          dashboard.allDevArray = dashboard.data.getDevicesArray.filter(function(dev) {
            return dev.lastused
          }).sort(function(a, b) {
            return Date.parse(b.lastused) - Date.parse(a.lastused)
          });

          dashboard.getScenes = dashboard.data.getScenes ? dashboard.data.getScenes.slice(0, 5) : [];
          dashboard.getSchedules = dashboard.data.getSchedules ? dashboard.data.getSchedules.slice(0, 5) : [];
          dashboard.getRecordings = dashboard.data.getRecordings ? dashboard.data.getRecordings.slice(0, 5) : [];
        })
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
        dataService.getCategoriesEmit();
      }
    }]);
}());
