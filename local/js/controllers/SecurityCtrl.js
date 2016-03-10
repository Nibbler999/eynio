(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('SecurityCtrl', ['$scope', 'dataService', 'socket', function($scope, dataService, socket) {

      var security = this;

      /**
       * @name loadMoreRecordings
       * @desc on click, load 20 more recorings
       * @type {function}
       * @param {allRec} all recorin
       */
      security.loadMoreRecordings = function() {
        var start = security.latestRecordings.length
        var end = security.latestRecordings.length + 20;
        security.latestRecordings = security.latestRecordings
          .concat(security.bigData.getRecordings.slice(start, end));
      };
      // listen for deleted recording and remove from allDevArray
      $scope.$on('deleteRecording', function(event, recId) {
        angular.forEach(security.latestRecordings, function(rec, index) {
          if (rec.id === recId) {
            security.latestRecordings.splice(index, 1);
          }
        });
      });
      // get data
      security.data = dataService.getData();
      security.bigData = dataService.getBigData();
      security.latestRecordings = security.bigData.getRecordings ? security.bigData.getRecordings.slice(0, 20) : [];
      // if no data, wait on socket
      if (!security.data.getDevicesObj || !security.bigData.getRecordings) {
        dataService.getDevicesEmit().then(function(devices) {
          security.data.getDevicesObj = devices;
          console.log(security.data.getDevicesObj);
          dataService.getRecordingsEmit().then(function(recordings) {
            security.bigData.getRecordings = recordings;
            security.latestRecordings = security.bigData.getRecordings.slice(0, 20);
          });
        });
        // run other data fetches
        dataService.getServerEmits();
        dataService.getCategoriesEmit();
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
      }
    }]);
}());
