
var UpnpControlPoint = require("upnp-controlpoint").UpnpControlPoint;
var xml2js = require('xml2js');

var conn, devices = {};

function log(msg)
{
    console.log('[UPnP] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {
    
        log('Accepted');

        var cp = new UpnpControlPoint();

        cp.on("device", function(device) {

            if (device.deviceType == 'urn:samsung.com:device:MainTVServer2:1') {
                samsungAuth(device.services['urn:samsung.com:serviceId:MainTVAgent2']);
            }

            if (device.deviceType == 'urn:schemas-upnp-org:device:MediaRenderer:1') {
                devices[device.uuid] = {
                    name: device.friendlyName,
                    dev: device,
                };
            }
        });

        cp.search();

        startListening();
    });
}

function samsungAuth(service)
{
    service.callAction('GetCurrentMainTVChannel', {}, function(err,  result) {
        if (err) {
            log('samsungAuth:' + err);
            return;
        }

        if (result) {
            log('Authenticated with Samsung TV');
        }
    });
}

function startListening()
{
    log('Ready for commands');

    conn.on('setVolume', function (id, volume) {
        setVolume(id, volume);    
    });

    conn.on('getVolume', function (id) {
        getVolume(id);    
    });

    conn.on('setVolumeUp', function (id) {
        setVolumeUp(id);    
    });

    conn.on('setVolumeDown', function (id) {
        setVolumeDown(id);    
    });

    conn.on('getMultiMedia', function () {
        getMultiMedia();
    });
}

function getMultiMedia()
{
    var multimedia = [];

    for (device in devices) {
        multimedia.push({id: device, name: devices[device].name});
    }

    conn.emit('multimedia', multimedia);
}

function setVolume(id, volume)
{
    var args = {
        InstanceID: 0,
        Channel : 'Master',
        DesiredVolume: volume
    };

    devices[id].dev.services['urn:upnp-org:serviceId:RenderingControl'].callAction('SetVolume', args, function(err,  result) {

        if (err) {
            log('setVolume:' + err);
            return;
        }

        if (result) {
            getVolume(id);
        }
    });
}

function setVolumeUp(id)
{
    adjustVolume(id, 1);
}

function setVolumeDown(id)
{
    adjustVolume(id, -1);
}

function adjustVolume(id, increment)
{
    var args = {
        InstanceID: 0,
        Channel : 'Master'
    };

    devices[id].dev.services['urn:upnp-org:serviceId:RenderingControl'].callAction('GetVolume', args, function(err,  result) {

        if (err) {
            log('adjustVolume:' + err);
            return;
        }

    	xml2js.parseString(result, function(err, result) {
            var reply = result['s:Envelope']['s:Body'][0]['u:GetVolumeResponse'][0].CurrentVolume[0];
            var volume = parseInt(reply, 10);
            setVolume(id, volume + increment);
        });  
    });
}

function getVolume(id)
{
    var args = {
        InstanceID: 0,
        Channel : 'Master'
    };

    devices[id].dev.services['urn:upnp-org:serviceId:RenderingControl'].callAction('GetVolume', args, function(err,  result) {

        if (err) {
            log('getVolume:' + err);
            return;
        }

    	xml2js.parseString(result, function(err, result) {
            var reply = result['s:Envelope']['s:Body'][0]['u:GetVolumeResponse'][0].CurrentVolume[0];
            var volume = parseInt(reply, 10);
            conn.emit('volume', {id: id, volume: volume});
        });  
    });
}
