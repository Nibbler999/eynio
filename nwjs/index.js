
$(function() {

    // Load native UI library
    var gui = require('nw.gui');

    // Get the current window
    var win = gui.Window.get();

    win.show();

    var clickedTab = document.getElementsByClassName('server-nav-tab');

    for (var i = 0; i < clickedTab.length; i++) {
        clickedTab[i].addEventListener('click', function (e) {
            e.preventDefault();

            for (var j = 0; j < clickedTab.length; j++) {
                document.getElementById(clickedTab[j].id).classList.remove('active-tab');
                document.getElementById(clickedTab[j].id + '-view').classList.remove('content-active');
            }

            document.getElementById(this.id + '-view').classList.add('content-active');
            this.classList.add('active-tab');
        });
    };

    var stream = require('stream');

    var entries = [];

    var weblog = new stream.Writable({
        write: function(chunk, encoding, next) {
            entries.push(chunk.toString());
            if (entries.length > 50) {
                entries.shift();
            }
            document.getElementById('console').textContent = entries.join('');
            next();
        }
    });

    var bunyan = require('bunyan');
    var PrettyStream = require('bunyan-prettystream');

    var prettyStdOut = new PrettyStream({mode: 'short', useColor: false});
    prettyStdOut.pipe(weblog);

    var ringbuffer = new bunyan.RingBuffer({ limit: 100 });

    var log = bunyan.createLogger({
        name: 'NHome',
        streams: [{
            level: 'info',
            stream: prettyStdOut
        }, {
            level: 'info',
            type: 'raw',
            stream: ringbuffer
        }]
    });

    require('../update.js')(log, function (conn) {

        conn.on('setExternalIP', function (command) {
            $('#external_ip').text(command.args[0]);
        });

        conn.on('setPing', function (ping) {
            $('#ping').text(ping + 'ms');
        });

        conn.command('getServerStatus', function (status) {
            $('#server-name').val(status.name);
            $('#local_ip').text(status.ip);
            $('#app_version').text(status.version);
            $('#node_version').text(status.node_version);
            $('#node_platform').text(status.node_platform);
        });

        conn.command('getBridges', function (bridges) {
            if (bridges) {
                $('#bridge_count').text(bridges.length);
            } else {
                $('#bridge_count').text(0);
            }
        });

        conn.command('getDevices', function (devices) {

            if (devices) {

                $('#device_count').text(devices.length);

                $('.status-dropdown').remove();

                devices.forEach(function (device) {

                    var d = $('<div class="status-dropdown"><div><p class="H_blue">' + device.name + '</p><p class="H_gray"></p></div><span class="arrow-down"></span></div>');

                    $('#status-view').append(d);
                });
            } else {
                $('#device_count').text(0);
            }
        });
    });
});

