(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('ScheduleCtrl', ['dataService', function(dataService) {

      var schedule = this;

      /* get data */
      schedule.allSchedules = dataService.schedules() ? dataService.schedules() : dataService.dataPending().then(function() {
        schedule.allSchedules = dataService.schedules();
      });
    }]);
}());
