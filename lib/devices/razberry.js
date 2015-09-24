"use strict";

var Namer = require('../services/namer.js');
var cfg = require('../configuration.js');

var tcpp = require('tcp-ping');

var conn, devices = {}, ip, bridges = {};

var logger;

function log()
{
    logger.info.apply(logger, arguments);
}

module.exports = function(c, l) {

    conn = c;
    logger = l.child({component: 'RaZberry'});

    // COMODO RSA Certification Authority
    var ca = [ "-----BEGIN CERTIFICATE-----\n" +
    "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\n" +
    "LaZRfyHBNVOFBkpdn627G190\n" +
    "-----END CERTIFICATE-----\n",

    // COMODO RSA Domain Validation Secure Server CA
    "-----BEGIN CERTIFICATE-----\n" +
   "MIIGCDCCA/CgAwIBAgIQKy5u6tl1NmwUim7bo3yMBzANBgkqhkiG9w0BAQwFADCB\n" +
   "hTELMAkGA1UEBhMCR0IxGzAZBgNVBAgTEkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4G\n" +
   "A1UEBxMHU2FsZm9yZDEaMBgGA1UEChMRQ09NT0RPIENBIExpbWl0ZWQxKzApBgNV\n" +
   "BAMTIkNPTU9ETyBSU0EgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMTQwMjEy\n" +
   "MDAwMDAwWhcNMjkwMjExMjM1OTU5WjCBkDELMAkGA1UEBhMCR0IxGzAZBgNVBAgT\n" +
   "EkdyZWF0ZXIgTWFuY2hlc3RlcjEQMA4GA1UEBxMHU2FsZm9yZDEaMBgGA1UEChMR\n" +
   "Q09NT0RPIENBIExpbWl0ZWQxNjA0BgNVBAMTLUNPTU9ETyBSU0EgRG9tYWluIFZh\n" +
   "bGlkYXRpb24gU2VjdXJlIFNlcnZlciBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP\n" +
   "ADCCAQoCggEBAI7CAhnhoFmk6zg1jSz9AdDTScBkxwtiBUUWOqigwAwCfx3M28Sh\n" +
   "bXcDow+G+eMGnD4LgYqbSRutA776S9uMIO3Vzl5ljj4Nr0zCsLdFXlIvNN5IJGS0\n" +
   "Qa4Al/e+Z96e0HqnU4A7fK31llVvl0cKfIWLIpeNs4TgllfQcBhglo/uLQeTnaG6\n" +
   "ytHNe+nEKpooIZFNb5JPJaXyejXdJtxGpdCsWTWM/06RQ1A/WZMebFEh7lgUq/51\n" +
   "UHg+TLAchhP6a5i84DuUHoVS3AOTJBhuyydRReZw3iVDpA3hSqXttn7IzW3uLh0n\n" +
   "c13cRTCAquOyQQuvvUSH2rnlG51/ruWFgqUCAwEAAaOCAWUwggFhMB8GA1UdIwQY\n" +
   "MBaAFLuvfgI9+qbxPISOre44mOzZMjLUMB0GA1UdDgQWBBSQr2o6lFoL2JDqElZz\n" +
   "30O0Oija5zAOBgNVHQ8BAf8EBAMCAYYwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNV\n" +
   "HSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwGwYDVR0gBBQwEjAGBgRVHSAAMAgG\n" +
   "BmeBDAECATBMBgNVHR8ERTBDMEGgP6A9hjtodHRwOi8vY3JsLmNvbW9kb2NhLmNv\n" +
   "bS9DT01PRE9SU0FDZXJ0aWZpY2F0aW9uQXV0aG9yaXR5LmNybDBxBggrBgEFBQcB\n" +
   "AQRlMGMwOwYIKwYBBQUHMAKGL2h0dHA6Ly9jcnQuY29tb2RvY2EuY29tL0NPTU9E\n" +
   "T1JTQUFkZFRydXN0Q0EuY3J0MCQGCCsGAQUFBzABhhhodHRwOi8vb2NzcC5jb21v\n" +
   "ZG9jYS5jb20wDQYJKoZIhvcNAQEMBQADggIBAE4rdk+SHGI2ibp3wScF9BzWRJ2p\n" +
   "mj6q1WZmAT7qSeaiNbz69t2Vjpk1mA42GHWx3d1Qcnyu3HeIzg/3kCDKo2cuH1Z/\n" +
   "e+FE6kKVxF0NAVBGFfKBiVlsit2M8RKhjTpCipj4SzR7JzsItG8kO3KdY3RYPBps\n" +
   "P0/HEZrIqPW1N+8QRcZs2eBelSaz662jue5/DJpmNXMyYE7l3YphLG5SEXdoltMY\n" +
   "dVEVABt0iN3hxzgEQyjpFv3ZBdRdRydg1vs4O2xyopT4Qhrf7W8GjEXCBgCq5Ojc\n" +
   "2bXhc3js9iPc0d1sjhqPpepUfJa3w/5Vjo1JXvxku88+vZbrac2/4EjxYoIQ5QxG\n" +
   "V/Iz2tDIY+3GH5QFlkoakdH368+PUq4NCNk+qKBR6cGHdNXJ93SrLlP7u3r7l+L4\n" +
   "HyaPs9Kg4DdbKDsx5Q5XLVq4rXmsXiBmGqW5prU5wfWYQ//u+aen/e7KJD2AFsQX\n" +
   "j4rBYKEMrltDR5FL1ZoXX/nUh8HCjLfn4g8wGTeGrODcQgPmlKidrv0PJFGUzpII\n" +
   "0fxQ8ANAe4hZ7Q7drNJ3gjTcBpUC2JD5Leo31Rpg0Gcg19hCC0Wvgmje3WYkN5Ap\n" +
   "lBlGGSW4gNfL1IYoakRwJiNiqZ+Gb7+6kHDSVneFeO/qJakXzlByjAA6quPbYzSf\n" +
   "+AZxAeKCINT+b72x\n" +
   "-----END CERTIFICATE-----\n"];

    require('request')({ url: 'https://find.z-wave.me/zboxweb', ca: ca }, function (error, response, body) {

        if (!error && response.statusCode === 200) {

            var regex = /<a href="http:..([0-9.]+):808.">/;

            var matches = regex.exec(body);

            if (!matches) {
                return;
            }

            ip = matches[1];

            tcpp.probe(ip, 8083, function (err, available) {

                if (err) {
                    logger.debug(err);
                }

                if (available) {

                    bridges['raz:' + ip] = ip;

                    update(startListening);

                } else {
                    logger.debug('Found ip', ip, 'but it was not reachable');
                }
            });
        }
    });
};

function startListening()
{
    log('Ready for commands');

    conn.on('getBridges', function (command) {
        getBridges.apply(command, command.args);
    });

    conn.on('getDevices', function (command) {
        getDevices.apply(command, command.args);
    });

    conn.on('switchOn', function (command) {
        switchOn.apply(command, command.args);
    });

    conn.on('switchOff', function (command) {
        switchOff.apply(command, command.args);
    });

    conn.on('getSwitchState', function (command) {
        getSwitchState.apply(command, command.args);
    });

    conn.on('getDevicePowerState', function (command) {
        getDevicePowerState.apply(command, command.args);
    });

    conn.on('setDevicePowerState', function (command) {
        setDevicePowerState.apply(command, command.args);
    });

    conn.on('toggleDevicePowerState', function (command) {
        toggleDevicePowerState.apply(command, command.args);
    });
}

function getBridges(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    var bridgeInfo = [];

    for (var bridge in bridges) {
        bridgeInfo.push({
            name: 'RaZberry',
            module: 'razberry',
            id: bridge,
            ip: null,
            mac: null,
            blacklisted: blacklist.indexOf(bridge) !== -1
        });
    }

    conn.broadcast('bridgeInfo', bridgeInfo);

    if (typeof cb === 'function') {
        cb(bridgeInfo);
    }
}

function getDevices(cb)
{
    update(function() {

        var all = [];

        for (var device in devices) {
            if (devices[device].commandClasses.hasOwnProperty('37')) {
                all.push({
                    id: device,
                    name: Namer.getName(device),
                    type: 'switch',
                    module: 'razberry'
                });
            }
        }

        require('../common.js').addDeviceProperties(all);

        if (typeof cb === 'function') {
            cb(all);
        }
    });
}

function switchOn(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var device = devices[id].id;
    var self = this;

    require('request')('http://' + ip + ':8083/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(255)', function(err, response) {

        if (err) {
            log(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (response.statusCode === 200) {
            self.log(id, Namer.getName(id), 'switch-on');
            conn.broadcast('switchState', { id: id, state: { on: true }});
            if (typeof cb === 'function') {
                cb(true);
            }
        } else {
            log('switchOn', response.statusCode);
            if (typeof cb === 'function') {
                cb(false);
            }
        }
    });
}

function switchOff(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var device = devices[id].id;
    var self = this;

    require('request')('http://' + ip + ':8083/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(0)', function(err, response) {

        if (err) {
            log(err);
            if (typeof cb === 'function') {
                cb(false);
            }
            return;
        }

        if (response.statusCode === 200) {
            self.log(id, Namer.getName(id), 'switch-off');
            conn.broadcast('switchState', { id: id, state: { on: false }});
            if (typeof cb === 'function') {
                cb(true);
            }
        } else {
            log('switchOn', response.statusCode);
            if (typeof cb === 'function') {
                cb(false);
            }
        }
    });
}

function setDevicePowerState(id, on, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    if (on) {
        switchOn.call(this, id, cb);
    } else {
        switchOff.call(this, id, cb);
    }
}

function getDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    getSwitchState(id, function (state) {
        if (typeof cb === 'function') {
            cb(state.on);
        }
    });
}

function toggleDevicePowerState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    var self = this;

    getDevicePowerState(id, function (state) {
        setDevicePowerState.call(self, id, !state, cb);
    });
}

function getSwitchState(id, cb)
{
    if (!devices.hasOwnProperty(id)) {
        if (typeof cb === 'function') {
            cb();
        }
        return;
    }

    update(function() {
        var switchState = { on: devices[id].commandClasses['37'].data.level.value};
        conn.broadcast('switchState', { id: id, state: switchState});
        if (typeof cb === 'function') {
            cb(switchState);
        }
    });
}

function update(cb)
{
    var blacklist = cfg.get('blacklist_bridges', []);

    if (blacklist.indexOf('raz:' + ip) !== -1) {
        devices = {};
        return;
    }

    require('request')('http://' + ip + ':8083/ZWaveAPI/Data/0', function(err, response, body) {

        if (err) {
            log(err);
            return;
        }

        if (response.statusCode !== 200) {
            log('ZWaveAPI/Data failure', body.trim());
            return;
        }

        var status = JSON.parse(body);

        devices = {};

        for (var d in status.devices) {

            if (d === '1') {
                continue;
            }

            devices['razberry-' + d] = {
                id: d,
                name: 'Device ' + d,
                commandClasses: status.devices[d].instances[0].commandClasses
            };
        }

        Namer.add(devices);

        if (typeof cb === 'function') {
            cb();
        }
    });
}
