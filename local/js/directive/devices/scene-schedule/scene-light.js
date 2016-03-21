(function() {
  "use strict";

  angular
    .module('services')
    .directive('sLight', ['$state', 'socket', function($state, socket) {
      return {
        restrict: 'E',
        replace: true,
        templateUrl: 'html/directive/devices/scene-schedule-dev/scene-light.html',
        scope: {
          linfo: '='
        },
        require: '^addScene',
        controllerAs: 'sceneLightCtrl',
        controller: ['$scope', function($scope) {

          var sceneLightCtrl = this;
          var deviceObj = $scope.linfo;
          /**
           * @name setDeviceIcon
           * @desc set device icon depending on state
           * @type {function}
           */
          function setDeviceIcon() {
            if (deviceObj.state.on) {
              sceneLightCtrl.deviceIcon = 'img/device/light-on.png';
            } else {
              sceneLightCtrl.deviceIcon = 'img/device/light-off.png';
            }
          }

          setDeviceIcon();
          // exports
          sceneLightCtrl.deviceObj = deviceObj;
        }],
        link: function(scope, elem, attr, ctrl) {

          var deviceObj = scope.linfo;
          // action btns
          var toggleStateBtn = elem[0].querySelector('.device-icon');
          var onButton = elem[0].querySelectorAll('.device-btn')[0];
          var offButton = elem[0].querySelectorAll('.device-btn')[1];
          var setWhiteBtn = elem[0].querySelector('.device-option-set-white');
          var setColorBtn = elem[0].querySelector('.set-color-btn');
          // light DOM elem
          var deviceOptionsBtn = elem[0].querySelector('.device-options-btn');
          var deviceOptionsWrap = elem[0].querySelector('.device-options');
          var deviceOptionsColor = elem[0].querySelector('.device-option-color');
          var deviceOptionsColorPicker = elem[0].querySelector('.option-wrap');
          var deviceColorPicker = deviceOptionsColorPicker.querySelector('#color-picker');
          var deviceColorPickerClose = deviceOptionsColorPicker.querySelector('.close-device-options');

          /**
           * @name toggleStateBtn
           * @desc change device state and add to scene directive
           * @type {event}
           */
          toggleStateBtn.addEventListener('click', function() {
            deviceObj.state.on = !deviceObj.state.on;
            ctrl.addDeviceToScene(deviceObj, 'setDevicePowerState', deviceObj.state.on);
            scope.$apply();
          }, false);
          /**
           * @name onButton
           * @desc set device powe state on, add to scene directive
           * @type {event}
           */
          onButton.addEventListener('click', function() {
            deviceObj.state.on = true;
            ctrl.addDeviceToScene(deviceObj, 'setDevicePowerState', deviceObj.state.on);
            scope.$apply();
          }, false);
          /**
           * @name offButton
           * @desc set device powe state pff, add to scene directive
           * @type {event}
           */
          offButton.addEventListener('click', function() {
            deviceObj.state.on = false;
            ctrl.addDeviceToScene(deviceObj, 'setDevicePowerState', deviceObj.state.on);
            scope.$apply();
          }, false);
          /**
           * @name setWhiteBtn
           * @desc set device color to white, add to scenes
           * @type {event}
           */
          setWhiteBtn.addEventListener('click', function() {
            deviceObj.state.on = true;
            ctrl.addDeviceToScene(deviceObj, 'setLightWhite', 100, 0);
            scope.$apply();
          }, false);
          /**
           * @name setColorBtn
           * @desc set light color, add to scenes
           * @type {event}
           */
          setColorBtn.addEventListener('click', function() {
            deviceObj.state.on = true;
            ctrl.addDeviceToScene(deviceObj, 'setLightColor', deviceObj.state.hsl, 'hsl');
            scope.$apply();
          }, false);
          /**
           * @name deviceOptionsBtn
           * @desc toggle hidden class on options wrap
           * @type {event}
           */
          deviceOptionsBtn.addEventListener('click', function() {
            deviceOptionsWrap.classList.toggle('hidden');
          }, false);
          /**
           * @name deviceOptionsColor
           * @desc show color picker
           * @type {event}
           */
          deviceOptionsColor.addEventListener('click', function() {
            deviceOptionsColorPicker.classList.remove('hidden');
            initColorPicker(deviceColorPicker);
          }, false);
          /**
           * @name
           * @desc
           * @type {type}
           * @param {param}
           */
          deviceColorPickerClose.addEventListener('click', function() {
            deviceOptionsColorPicker.classList.add('hidden');
            while (deviceColorPicker.firstChild) {
              deviceColorPicker.removeChild(deviceColorPicker.firstChild);
            }
          }, false);
          /**
           * @name initColorPicker
           * @desc create color picker
           * @type {function}
           * @param {element} DOM element to create color picker
           */
          function initColorPicker(element) {
            $(element).ColorPickerSliders({
              color: 'hsl(' + deviceObj.state.hsl[0] + ',' + deviceObj.state.hsl[1] + ',' + deviceObj.state.hsl[2] + ')',
              updateinterval: 1,
              flat: true,
              swatches: false,
              order: {
                hsl: 1
              },
              labels: {
                hslhue: '',
                hslsaturation: '',
                hsllightness: ''
              },
              onchange: function(container, color) {
                deviceObj.state.hsl[0] = color.tiny.toHsl().h;
                deviceObj.state.hsl[1] = color.tiny.toHsl().s;
                deviceObj.state.hsl[2] = color.tiny.toHsl().l;
              }
            });
          }
        }
      };
    }]);
}());
