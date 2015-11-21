(function () {
    "use strict";

    angular
        .module('services')
        .directive('shutter', ['dataService', '$state', 'socket', function (dataService,  $state, socket) {
            return {
                restrict: 'E',
                replace: true,
                templateUrl: 'directive/devices/shutter.html',
                scope: {
                    shinfo: '='
                },
                link: function (scope, elem, attr) {
                    var dragging = false;

                    var shutterAt;

                    var handle = document.getElementById('handle');
                    var shutterWrap = document.getElementById('shWrap');
                    var shutterFilter = document.getElementById('shFilter');

                    handle.id = handle.id + scope.shinfo.count;
                    shutterWrap.id = shutterWrap.id + scope.shinfo.count;
                    shutterFilter.id = shutterFilter.id + scope.shinfo.count;

                    handle.onmousedown = function (e) {
                        e.preventDefault();
                        dragging = true;
                        handle.style.cursor = 'move';
                        var start = e.clientY;
                        shutterWrap.onmouseup = function (e) {
                            if (dragging) {
                                var height = shutterFilter.clientHeight;
                                shutterFilter.style.height = height + (start - e.clientY) + 'px';
                                dragging = false;
                                handle.style.cursor = '-webkit-grab';
                            }
                        }
                    };

                    /* set value of shutter */
                    socket.emit('getShutterValue', scope.shinfo.id, function (shutterData) {
                        shutterAt = (shutterData.value / 100) * 126;
                        shutterFilter.style.height = shutterAt + 'px';
                        console.log(shutterAt);
                    });
                    socket.on('shutterValue', function(newShutterVal){
                      console.log(newShutterVal);
                    });

                    scope.setShutterValue = function (id) {
                        shutterAt = shutterFilter.clientHeight;
                        console.log(shutterAt);
                        shutterAt = (shutterAt / 126) * 100;
                        console.log(shutterAt);
                        socket.emit3('setShutterValue', id, shutterAt, function (data) {
                            console.log(data);
                        });
                    };

                    /* full open */
                    scope.fullOpen = function (id) {
                        socket.emit('openShutter', id, function (newVal) {
                            shutterFilter.style.height = '126px';
                        });
                    };
                    /* full close */
                    scope.fullClose = function (id) {
                        socket.emit('closeShutter', id, function (newVal) {
                            shutterFilter.style.height = '0px';
                        });
                    };
                    /* stop open/close */
                    scope.shutterStop = function (id) {
                        socket.emit('stopShutter', id, function (shutterData) {
                            if (shutterData.id === id) {
                                shutterAt = (shutterData.value / 100) * 126;
                                shutterFilter.style.height = shutterAt + 'px';
                            }
                        })
                    };
                    /*$('#handle').mousedown(function (e) {
                        e.preventDefault();
                        dragging = true;
                        $(this).css('cursor', 'move');
                        var start = e.clientY;
                        $('#shutterWrap').mouseup(function (e) {
                            if (dragging) {
                                $('#shutterFilter').css('height', start - e.clientY + 15);
                                dragging = false;
                            }
                        })
                    })*/


                    /* change name of device */
                    scope.changeName = function () {
                        socket.emit3('setDeviceName', scope.shinfo.id, scope.shinfo.name,
                            function (newName) {
                                scope.shinfo.name = newName;
                            })
                    };


                    /* where am I */
                    scope.devicesState = $state.current.name;


                }
            };
   }]);
}());
