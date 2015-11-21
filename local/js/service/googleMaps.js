(function() {
  "use strict";

  angular
    .module('services')
    .directive('googleMaps', ['socket', function(socket) {
      return {
        restrict: 'E',
        replace: true,
        scope: true,
        templateUrl: 'directive/googleMaps.html',
        link: function(scope, elem, attrs) {

          var map, marker, keys, input;
          var longitude, latitude;

          scope.$on('getGoogleMap', function(event, location) {
            initMap(location);
          });

          scope.$on('useIP', function() {
            getLocation();
          });

          // create google map
          var initMap = function(location) {
            if (map) {
              return false;
            } else {
              map = new google.maps.Map(document.getElementById('map'), {
                center: location,
                zoom: 8,
                mapTypeId: google.maps.MapTypeId.ROADMAP
              });
              // search with autocomplete
              input = document.getElementById('pac-input');
              map.controls[google.maps.ControlPosition.LEFT_TOP].push(input);
              var autocomplete = new google.maps.places.Autocomplete(input);
              autocomplete.bindTo('bounds', map);
              pinMap(location, map);

              autocomplete.addListener('place_changed', function() {
                var place = autocomplete.getPlace();
                if (!place.geometry) {
                  return
                }
                if (place.geometry.viewport) {
                  map.fitBounds(place.geometry.viewport);
                  marker.setMap(null);
                  pinMap(place.geometry.location, map);
                } else {
                  map.setCenter(place.geometry.location);
                  map.setZoom(12);
                  marker.setMap(null);
                  pinMap(place.geometry.location, map);
                }

                scope.$emit('notIpLocation');
              });

              map.addListener('click', function(event) {
                marker.setMap(null);
                pinMap(event.latLng, map);
                scope.$emit('notIpLocation');
              });
            }
          };

          // pin marker on location
          var pinMap = function(location, map) {
            marker = new google.maps.Marker({
              map: map,
              position: location,
              animation: google.maps.Animation.BOUNCE
            });

            socket.emit('configSet', 'latitude', marker.position.lat());
            socket.emit('configSet', 'longitude', marker.position.lng());
          };

          //get location of user
          var getLocation = function() {
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(function(position) {
                var location = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                }
                if (map) {
                  map.setCenter(location);
                  marker.setMap(null);
                  pinMap(location, map);
                } else {
                  initMap(location);
                }
                socket.emit('configSet', 'latitude', position.coords.latitude);
                socket.emit('configSet', 'longitude', position.coords.longitude);
              });
            } else {
              alert('Geolocation is not supported by this browser.');
            }
          };
        }
      }
    }]);
}());
