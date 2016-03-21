(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ScheduleCtrl', ['$scope', 'dataService', function($scope, dataService) {

      var schedule = this;

      // get data
      schedule.data = dataService.getData();
      if (!schedule.data.getSchedules) {
        dataService.getSchedulesEmit().then(function(schedules) {
          schedule.data.getSchedules = schedules;
        })
        // run other data fetches
        dataService.getDevicesEmit();
        dataService.getServerEmits();
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getRecordingsEmit();
      }
    }]);
}());
