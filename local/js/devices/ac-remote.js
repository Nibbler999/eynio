(function () {
    "use strict";

    angular
        .module('services')
        .directive('acremote', [
            'dataService', 'socket', '$state',
            function (dataService, socket, $state) {
                return {
                    restrict: 'E',
                    replace: true,
                    templateUrl: 'directive/devices/ac-remote.html',
                    scope: {
                        acinfo: '='
                    },
                    link: function (scope, elem, attr) {

                        scope.currentState = $state.current.name;
                        scope.IRdevices = dataService.remotes();


                        var keys = ["POWER", "TOOLS", "SOURCE", "INFO", "UP", "DOWN", "LEFT", "RIGHT", "OK", "RETURN", "EXIT", "SETTINGS", "MENU", "MUTE", "TXT", "VOLUP", "VOLDOWN", "CHUP", "CHDOWN", "NUM_0", "NUM_1", "NUM_2", "NUM_3", "NUM_4", "NUM_5", "NUM_6", "NUM_7", "NUM_8", "NUM_9"];

                        /* change id of multiple remotes by count */
                        angular.forEach(keys, function (key) {
                            document.getElementById('rem-' + key.toLowerCase()).id = 'rem-' + scope.acinfo.count + '-' + key.toLowerCase();
                        });

                        /* add class active on learned keys */
                        angular.forEach(scope.acinfo.keys, function (key) {
                            document.getElementById('rem-' + scope.acinfo.count + '-' + key.toLowerCase()).classList.add('remote-btn-active');
                        });

                        /* learning mode id change */
                        angular.forEach(keys, function (key) {
                            document.getElementById('rem-learn-' + key.toLowerCase()).id = 'rem-learn-' + scope.acinfo.count + '-' + key.toLowerCase();
                        });
                        /* add class on already learned keys */
                        angular.forEach(scope.acinfo.keys, function (key) {
                            document.getElementById('rem-learn-' + scope.acinfo.count + '-' + key.toLowerCase()).classList.add('remote-btn-active');
                        });

                        scope.delteRemote = function (remoteId) {
                            socket.emit('deleteCustomRemote', remoteId);
                        };
                        scope.updateRemote = function (remoteId) {
                            socket.emit('updateCustomRemote', {
                                id: remoteId,
                                name: scope.acinfo.name,
                                keys: scope.acinfo.keys,
                                type: scope.acinfo.type,
                                deviceid: scope.acinfo.deviceid
                            });
                        };
                        scope.cRemoteAction = function (remoteId, key) {
                            socket.emit3('sendKey', remoteId, key, function (data) {
                                console.log(data);
                            });
                        };
                        scope.learnKey = function (remoteId, key) {
                            socket.emit('learnKey', remoteId, key, function (data) {
                                console.log(data);
                            });
                        };
                        socket.on('IRKeyLearned', function (keyLearned) {
                            if (keyLearned.remoteid === scope.acinfo.id) {
                                scope.acinfo.keys.push(keyLearned.key);
                                document.getElementById('rem-learn-' + scope.acinfo.count + '-' + keyLearned.key.toLowerCase()).classList.add('remote-btn-active');
                            }
                        });
                    }
                }
            }]);
}());