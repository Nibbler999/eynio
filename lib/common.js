"use strict";

var deepExtend = require('deep-extend');
var cfg = require('./configuration.js');

var common = {};

common.addDeviceProperties = function (devicelist) {

    var Cats = require('./services/cats.js');
    var Props = require('./services/device-properties.js');

    var blacklist = cfg.get('blacklist_devices', []);
    var activations = cfg.get('device_activations', {});
    var usecount = cfg.get('device_usecount', {});
    var lastused = cfg.get('device_lastused', {});

    var id = '', deviceProperties = {}, userProperties = {};

    for (var d = 0; d < devicelist.length; d++) {
        id = devicelist[d].id;
        devicelist[d].category = Cats.getCat(id);
        devicelist[d].blacklisted = blacklist.indexOf(id) !== -1;

        deviceProperties = Props.getDeviceProperties(id);

        for (var p in deviceProperties) {
            devicelist[d][p] = deviceProperties[p];
        }

        if (this.hasOwnProperty('user_id')) {

            userProperties = Props.getUserProperties(id, this.user_id);

            for (p in userProperties) {
                devicelist[d][p] = userProperties[p];
            }

            if (lastused[id] && lastused[id][this.user_id]) {
                devicelist[d].lastused = lastused[id][this.user_id];
            }
        }

        if (activations[id]) {
            devicelist[d].last_activated = activations[id];
        } else {
            devicelist[d].last_activated = null;
        }

        if (usecount[id]) {
            devicelist[d].usecount = usecount[id];
        } else {
            devicelist[d].usecount = 0;
        }
    }
};

common.hash_to_array = function (hash) {

    var array = [], object;

    for (var key in hash) {

        object = {
            id: key
        };

        for (var key2 in hash[key]) {
            object[key2] = hash[key][key2];
        }

        array.push(object);
    }

    return array;
};

common.invert_action = function (action) {

    var inverted = deepExtend({}, action);

    switch (action.emit_name) {

    case 'setDevicePowerState':
        inverted.params[1] = !action.params[1];
        break;

    case 'setLightColor':
    case 'setLightWhite':
        inverted.emit_name = 'setDevicePowerState';
        inverted.params[1] = false;
        break;

    case 'switchOn':
        inverted.emit_name = 'switchOff';
        break;

    case 'switchOff':
        inverted.emit_name = 'switchOn';
        break;

    case 'openShutter':
        inverted.emit_name = 'closeShutter';
        break;

    case 'closeShutter':
        inverted.emit_name = 'openShutter';
        break;
    }

    return inverted;
};

module.exports = common;

