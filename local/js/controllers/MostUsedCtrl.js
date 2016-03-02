(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('MostUsedCtrl', ['dataService', function(dataService) {

      var mostUsed = this;

      /* get data */
      mostUsed.data = dataService.getData();

      if (mostUsed.data.getDevicesArray) {

        mostUsed.allDevArray = mostUsed.data.getDevicesArray.filter(function(dev){
          return dev.usecount
        }).sort(function(a ,b){
          return b.usecount - a.usecount;
        });
      } else {
        dataService.getDevicesEmit().then(function(devices){
          mostUsed.data = dataService.getData();
          mostUsed.allDevArray = mostUsed.data.getDevicesArray.filter(function(dev){
            return dev.usecount
          }).sort(function(a ,b){
            return b.usecount - a.usecount;
          });
        })
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
        dataService.getServerEmits();
      }
    }]);
}());
