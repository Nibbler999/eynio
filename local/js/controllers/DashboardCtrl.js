(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('DashboardCtrl', ['dataService', '$stateParams', function(dataService, $stateParams) {

      var dashboard = this;

      /* get data */
      dashboard.data = dataService.getData();
      dashboard.bigData = dataService.getBigData();

      if (dashboard.data.getDevicesArray && dashboard.bigData.getRecordings) {
        dashboard.uncategorised = dashboard.data.getDevicesArray.filter(function(dev) {
          return dev.category === null
        });

        // dashboard.allDevArray = dashboard.data.getDevicesArray.filter(function(dev) {
        //   return dev.lastused
        // }).sort(function(a, b) {
        //   return Date.parse(b.lastused) - Date.parse(a.lastused)
        // });

        dashboard.getScenes = dashboard.data.getScenes ? dashboard.data.getScenes.slice(0, 5) : [];
        dashboard.getSchedules = dashboard.data.getSchedules ? dashboard.data.getSchedules.slice(0, 5) : [];
        dashboard.getRecordings = dashboard.bigData.getRecordings ? dashboard.bigData.getRecordings.slice(0, 5) : [];

        if ($stateParams.lastRoute) {
          fetchData();
        }
      } else {
        fetchData();
      }

      function fetchData (){
        dataService.getDevicesEmit().then(function(devices) {
          dataService.getRecordingsEmit().then(function() {
            dashboard.data = dataService.getData();
            dashboard.bigData = dataService.getBigData();

            dashboard.uncategorised = dashboard.data.getDevicesArray.filter(function(dev) {
              return !dev.category
            });

            // dashboard.allDevArray = dashboard.data.getDevicesArray.filter(function(dev) {
            //   return dev.lastused
            // }).sort(function(a, b) {
            //   return Date.parse(b.lastused) - Date.parse(a.lastused)
            // });

            dashboard.getScenes = dashboard.data.getScenes ? dashboard.data.getScenes.slice(0, 5) : [];
            dashboard.getSchedules = dashboard.data.getSchedules ? dashboard.data.getSchedules.slice(0, 5) : [];
            dashboard.getRecordings = dashboard.bigData.getRecordings ? dashboard.bigData.getRecordings.slice(0, 5) : [];
          });
        });
        dataService.getServerEmits();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getCategoriesEmit();
      }
    }]);
}());
