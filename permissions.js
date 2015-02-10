"use strict";

var Cats = require('./services/cats.js');

var always_permitted = [
    'getLights', 'getSwitches', 'getSensors', 'getRemotes', 'getCustomRemotes', 'getShutters',
    'addScheduleItem', 'deleteScheduleItem', 'saveSchedule', 'getSchedule',
    'getServerStatus', 'getBridges', 'log', 'updateApp',
    'catAdd', 'catList'
];

var device_commands = [
    'getLightState', 'setLightColor', 'setLightWhite', 'setLightLevel', 'setLightState',
    'switchOn', 'switchOff', 'getSwitchState',
    'getSensorValue',
    'sendRemoteCommand', 'sendKey', 'learnKey', 'saveCustomRemote', 'updateCustomRemote', 'deleteCustomRemote',
    'setVolumeUp', 'setVolumeDown', 'setChannelUp', 'setChannelDown',
    'getShutterValue', 'setShutterValue', 'openShutter', 'closeShutter',
    'setDeviceName', 'resetDeviceName',
    'catOfDevice'
];

var bridge_commands = [
    'setBridgeName', 'resetBridgeName', 'addNewDevices'
];

var category_commands = [
    'catDelete', 'catUpdate', 'catAddDevice', 'catDeleteDevice', 'catListDevices'
];

var permissions = {

    permitted_command: function (command) {

        // Commands that do not require permissions
        if (always_permitted.indexOf(command.name) !== -1) {
            return true;
        }

        // Device based commands
        if (device_commands.indexOf(command.name) !== -1) {

            // Device is permitted explicitly
            if (command.permissions.devices.indexOf(command.args[0]) !== -1) {
                return true;
            }

            // Device permitted via category
            if (command.permissions.categories.length > 0) {

                var cats = Cats.getCats(command.args[0]);
    
                if (cats.length > 0) {
    
                    var catmatches = command.permissions.categories.filter(function(n) {
                        return cats.indexOf(n) !== -1;
                    });
        
                    if (catmatches.length > 0) {
                        return true;
                    }
                }
            }

            // TODO: lookup bridge of the device and check that gives us permission
        }

        // Bridge based commands where the bridge is permitted
        if (bridge_commands.indexOf(command.name) !== -1) {

            if (command.permissions.bridges.indexOf(command.args[0]) !== -1) {
                return true;
            }

            return true; // not implemented
        }

        // Category based commands where the category is permitted
        if (category_commands.indexOf(command.name) !== -1) {

            if (command.permissions.categories.indexOf(command.args[0]) !== -1) {
                return true;
            }
        }

        console.warn('Denied access', command);

        return false;
    }
};

module.exports = permissions;
