
var http = require('http');

var Namer = require('../services/namer.js');

var conn, devices = {}, ip;

function log(msg)
{
    console.log('[RaZberry] ' + msg);
}

module.exports = function(c) {

    conn = c;

    conn.once('accepted', function (cfg) {

        require('request')('http://find.z-wave.me/', function (error, response, body) {

          if (!error && response.statusCode == 200) {

                var regex = /<a href="http:..([0-9.]+):8084">/

                var matches = regex.exec(body);

                if (!matches) {
                    return;
                }
    
                ip = matches[1];
    
                update(startListening);
            }
        });
    });
}

function startListening()
{
    log('Ready for commands');

    conn.on('switchOn', function (id) {
        switchOn(id);    
    });
    
    conn.on('switchOff', function (id) {
        switchOff(id);
    });

    conn.on('getSwitches', function () {
        getSwitches();
    });

    conn.on('getSwitchState', function (id) {
        getSwitchState(id);
    });
}

function getSwitches()
{
    update(function() {

        var switches = [];
    
        for (device in devices) {
            if (devices[device].commandClasses.hasOwnProperty('37') !== -1) {
                switches.push({id: device, name: Namer.getName(device)});
            }
        }
    
        conn.emit('switches', switches);
    });

}

function switchOn(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var device = devices[id].id;

    http.get('http://' + ip + ':8083/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(255)', function(res) {
        if (res.statusCode === 200) {
            conn.emit('switchState', { id: id, state: { on: true }});
        }
    });
}

function switchOff(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    var device = devices[id].id;

    http.get('http://' + ip + ':8083/ZWaveAPI/Run/devices[' + device + '].instances[0].commandClasses[0x25].Set(0)', function(res) {
        if (res.statusCode === 200) {
            conn.emit('switchState', { id: id, state: { on: false }});
        }
    });
}

function getSwitchState(id)
{
    if (!devices.hasOwnProperty(id)) {
        return;
    }

    update(function() {
        var on = devices[id].commandClasses['37'].data.level.value;
        conn.emit('switchState', { id: id, state: { on: on}});
    });
}

function update(cb)
{
    http.get('http://' + ip + ':8083/ZWaveAPI/Data/0', function(res) {

        var data = '';

        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function () {

            var status = JSON.parse(data);

            for (var d in status.devices) {

                if (d == '1') {
                    continue;
                }

                devices['razberry-' + d] = {
                    id: d,
                    name: 'Device ' + d,
                    commandClasses: status.devices[d].instances[0].commandClasses
                };
            }

            Namer.add(devices);

            cb && cb();
        });

    }).on('error', function(e) {
        log('ZWaveAPI/Data/0: ' + e.message);
    });
}
