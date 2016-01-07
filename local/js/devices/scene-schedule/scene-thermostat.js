(function() {
  "use strict";

  angular
    .module('services')
    .directive('sThermostat', [function() {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/scene-schedule-dev/scene-thermostat.html',
        scope: {
          tinfo: '='
        },
        link: function(scope, elem, attr) {


          // themostat target temp up
          scope.tempUp = function(thermo) {
            if (thermo.target < 32) {
              return thermo.target++;
            }
          };
          // thermostat target temp down
          scope.tempDown = function(thermo) {
            if (thermo.target > 18) {
              return thermo.target--;
            }
          };
          // set temperature
          scope.setTemp = function(thermo) {
            scope.$emit('deviceAction', thermo, 'setThermostatValue', thermo.target);
          };

        }
      }
    }])
}());
