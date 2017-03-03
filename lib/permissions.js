"use strict";

// broadcasts

var always_permitted = [
    'setExternalIP', // internal command
    'getBridges',
    'getActionLog',
    'getLog',
    'getWeather',
    'isAlarmEnabled',
    'getAlarmConfig',
    'getScenes',
    'getJobs',
    'getCategories',
    'getServerStatus',
    'checkUpdates'
];

var device_commands = [
    'setDeviceProperty', 'removeDeviceProperty',
    'setUserProperty', 'removeUserProperty',
    'getLightState', 'setLightColor', 'setLightWhite',
    'switchOn', 'switchOff', 'getSwitchState',
    'getSensorValue',
    'sendKey', 'learnKey',
    'getCamera',
    'getCachedThumbnail', 'getLiveThumbnail',
    'supportsPTZ', 'getPTZ',
    'moveCameraAbsolute', 'moveCameraRelative',
    'foscamMoveUp', 'foscamMoveDown', 'foscamMoveLeft', 'foscamMoveRight', 'foscamZoomIn', 'foscamZoomOut',
    'foscamSupportsZoom', 'foscamSupportsMove',
    'requestStreaming', 'stopStreaming',
    'startRecording', 'stopRecording',
    'enableMotionRecording', 'disableMotionRecording',
    'getShutterValue', 'setShutterValue', 'openShutter', 'closeShutter', 'stopShutter', 'toggleShutter',
    'getThermostatValue', 'setThermostatValue',
    'setDeviceName', 'resetDeviceName',
    'setDevicePowerState', 'getDevicePowerState', 'toggleDevicePowerState',
    'enableMotionAlarms', 'disableMotionAlarms'
];

var filter_devices = [
    'getRemotes', 'getCustomRemotes', 'getDevices'
];

var filter_cameras = [
    'getRecordings',
    'getSomeRecordings',
    'getSnapshots',
    'getSomeSnapshots'
];

var owner_only = [
    'configBackup',
    'configRestore'
];

var permissions = {

    permitted_device: function (usergroup, device) {

        // Device is permitted explicitly
        if (usergroup.devices.indexOf(device) !== -1) {
            return true;
        }

        return false;
    },

    permitted_command: function (command, usergroup) {

        // Commands that are owner only
        if (owner_only.indexOf(command.name) !== -1) {
            return false;
        }

        // Commands that are filtered later
        if (filter_devices.indexOf(command.name) !== -1) {
            return true;
        }

        // Commands that are filtered later
        if (filter_cameras.indexOf(command.name) !== -1) {
            return true;
        }

        // Commands that do not require permissions
        if (always_permitted.indexOf(command.name) !== -1) {
            return true;
        }

        // Device based commands
        if (device_commands.indexOf(command.name) !== -1) {
            return permissions.permitted_device(usergroup, command.args[0]);
        }

        return false;
    },

    filter_response: function (command, usergroup, response) {

        if (filter_devices.indexOf(command.name) !== -1) {

            return response.filter(function(device) {
                return permissions.permitted_device(usergroup, device.id);
            });
        }

        if (filter_cameras.indexOf(command.name) !== -1) {

            return response.filter(function(entry) {
                return permissions.permitted_device(usergroup, entry.cameraid);
            });
        }

        return response;
    }
};

module.exports = permissions;
