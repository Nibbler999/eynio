(function() {
  "use strict";

  angular
    .module('services')
    .factory('socket', ['$rootScope', function($rootScope) {
      var socket;

      return {
        connect: function(token, server) {
          if (!socket) {
            socket = io.connect('http://127.0.0.1:8008/client');
          }
          return socket;
        },
        on: function(eventName, callback) {
          if (typeof callback === 'function') {
            socket.on(eventName, function() {
              var args = arguments;
              $rootScope.$apply(function() {
                callback.apply(socket, args);
              });
            });
          } else {
            socket.on(eventName, callback);
          }
        },
        emit: function(eventName, data, callback) {
          if (!data) {
            socket.emit(eventName, function() {
              var args = arguments;
              $rootScope.$apply(function() {
                if (callback) {
                  callback.apply(socket, args);
                }
              });
            })
          } else if (typeof callback !== 'function') {
            socket.emit(eventName, data, callback);
          } else {
            socket.emit(eventName, data, function() {
              var args = arguments;
              $rootScope.$apply(function() {
                if (callback) {
                  callback.apply(socket, args);
                }
              });
            });
          }
        },
        emit3: function(eventName, id, newName, cb) {
          socket.emit(eventName, id, newName, function() {
            var args = arguments;
            $rootScope.$apply(function() {
              if (cb) {
                cb.apply(socket, args);
              }
            });
          });
        },
        emit4: function(eventName, id, color, format, cb) {
          socket.emit(eventName, id, color, format, function() {
            var args = arguments;
            $rootScope.$apply(function() {
              if (cb) {
                cb.apply(socket, args);
              }
            });
          });
        },
        disconnect: function() {
          return socket.disconnect();
        }
      };
    }]);
}());
