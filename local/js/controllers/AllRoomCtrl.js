(function() {
  "use strict";

  angular
    .module('nHome')
    .controller('AllRoomsCtrl', ['dataService', '$scope', 'socket', function(dataService, $scope, socket) {

      var allRooms = this;

      function sortDevices(categories, devices) {
        // wild sorting

        angular.forEach(categories, function(cat) {
          allRooms[cat.id] = {};
          angular.forEach(devices, function(devArray, type) {
            allRooms[cat.id][type] = allRooms[cat.id][type] || [];

            angular.forEach(devArray, function(dev) {
              if (dev.category === cat.id) {
                allRooms[cat.id][type].push(dev);
              }
            })
          })
        });
      };

      allRooms.changeCategoryName = function(cat) {
        socket.emit('catUpdate', cat.id, {
          name: cat.name
        });
      };
      allRooms.addRoom = function(e) {
        socket.emit('catAdd', {
          name: e.target.children[0].value
        }, function(response) {
          if (response) {
            allRooms.data.getCategories.push({
              id: response,
              name: e.target.children[0].value
            });
            e.target.children[0].value = '';
            allRooms.addRoomForm = false;
          }
          console.log(response);
        });
      };
      allRooms.deleteCategory = function(cat) {
        socket.emit('catDelete', cat.id, function(response) {
          console.log(response);
          if (response) {
            angular.forEach(allRooms.data.getCategories, function(category) {
              if (category.id === cat.id) {
                allRooms.data.getCategories.splice(allRooms.data.getCategories.indexOf(category), 1);
              }
            })
          }
        })
      };

      /* get data */
      allRooms.data = dataService.getData() || {};
      console.log('PPPPPPPPPPPP', allRooms.data);
      console.log(allRooms.data);
      //allRooms.categories = dataService.categories();
      //allRooms.activeRoom = allRooms.categories ? allRooms.categories[0] : {};
      allRooms.favoriteSensors = allRooms.data.getDevicesObj && 'sensor' in allRooms.data.getDevicesObj ? allRooms.data.getDevicesObj.sensor.filter(function(dev) {
        return dev.favorites
      }) : [];
      sortDevices(allRooms.data.getCategories, allRooms.data.getDevicesObj);

      console.log('AAAAAAAAAAAAAA', allRooms.data);
      /* wait on socket than get data */
      if (!allRooms.data.getBlacklisted || !allRooms.data.getDevicesObj || !allRooms.data.getCategories) {
        dataService.getCategoriesEmit().then(function(cats) {
          allRooms.data = dataService.getData() || {};
          allRooms.data.getCategories = cats;

          allRooms.favoriteSensors = allRooms.data.getDevicesObj && 'sensor' in allRooms.data.getDevicesObj ? allRooms.data.getDevicesObj.sensor.filter(function(dev) {
            return dev.favorites
          }) : [];
          sortDevices(allRooms.data.getCategories, allRooms.data.getDevicesObj);

          dataService.getDevicesEmit().then(function(devs) {
            console.log('BBBBBBBBBBBB', allRooms.data);
            allRooms.data.getDevicesObj = devs;

            allRooms.favoriteSensors = 'sensor' in allRooms.data.getDevicesObj ? allRooms.data.getDevicesObj.sensor.filter(function(dev) {
              return dev.favorites
            }) : [];
            sortDevices(allRooms.data.getCategories, allRooms.data.getDevicesObj);
          });
        });
        dataService.getScenesEmit();
        dataService.getSchedulesEmit();
        dataService.getRecordingsEmit();
      }
    }]);
}());
