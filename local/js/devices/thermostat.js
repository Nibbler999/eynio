(function() {
  "use strict";

  angular
    .module('services')
    .directive('thermostat', ['dataService', '$state', 'socket', function(dataService, $state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'directive/devices/thermostat.html',
        scope: {
          tinfo: '='
        },
        link: function(scope, elem, attr) {
          $('#slider').attr('id', 'slider' + scope.tinfo.count);
          $('#rotor').attr('id', 'rotor' + scope.tinfo.count);

          var slider = $('#slider' + scope.tinfo.count);
          var rotor = $('#rotor' + scope.tinfo.count);

          /* set up themrmo slider */
          slider.roundSlider({
            sliderType: "min-range",
            value: scope.tinfo.target,
            step: "0.5",
            circleShape: "pie",
            startAngle: 315,
            min: 16,
            max: "32",
            radius: 65,
            width: 10,
            keyboardAction: false,
            editableTooltip: false,
            showTooltip: false,

            change: function(args) {
              scope.tinfo.target = args.value;
              rotor.css('transform', 'rotate(' + (scope.tinfo.target * 16.875) + 'deg)');
              scope.$apply();
            },
            drag: function(args) {
              scope.tinfo.target = args.value;
              rotor.css('transform', 'rotate(' + (scope.tinfo.target * 16.875) + 'deg)');
              scope.$apply();
            }
          });
          socket.on('thermostatValue', function(thermoData) {
            console.log(thermoData);
            if (thermoData.id === scope.tinfo.id) {
              scope.tinfo.value = thermoData.value;
            }
          });
          /* rotate img to temp value */
          rotor.css('transform', 'rotate(' + (scope.tinfo.target * 16.875) + 'deg)');

          /* TEMP manipulation */
          scope.tempUp = function() {
            //dataService.tempUp(scope.tinfo, $state.current.name);
            if (scope.tinfo.target >= 32) {
              alert("you're going to fry yourself");
              return false;
            } else {
              scope.tinfo.target += 0.5;
              slider.roundSlider({
                value: scope.tinfo.target,
              });
              rotor.css('transform', 'rotate(' + (scope.tinfo.target * 16.875) + 'deg)');

            }
          };
          scope.tempDowno = function() {
            if (scope.tinfo.target <= 16) {
              alert('winter is comming');
              return false;
            } else {
              scope.tinfo.target -= 0.5;
              slider.roundSlider({
                value: scope.tinfo.target
              });
              rotor.css('transform', 'rotate(' + (scope.tinfo.target * 16.875) + 'deg)');
            }

          };
          scope.setTemp = function(id) {
            socket.emit3('setThermostatValue', id, scope.tinfo.target, function(data) {
              console.log(data);
            });
          };


          /* change name of device */
          scope.changeName = function() {
            socket.emit3('setDeviceName', scope.tinfo.id, scope.tinfo.name,
              function(newName) {
                scope.tinfo.name = newName;
              })
          };

          /* events */
          socket.on('thermostatValue', function(tempUpdate) {
            if (scope.tinfo.id === tempUpdate.id) {
              scope.tinfo.value === tempUpdate.value;
            }
          });


          /* where am I */
          scope.devicesState = $state.current.name;
        }
      };
    }]);
}());
