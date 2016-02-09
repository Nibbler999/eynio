window.onload = function() {

    var sidebarBtns = document.getElementsByClassName('sidebar-btn');

    for (var x in sidebarBtns) {
      sidebarBtns[x].onclick = function(e) {
        var oposite = this.value === 'terminal' ? 'settings' : 'terminal';
        if (this.classList[this.classList.length - 1] === 'active') {
          console.log('nothing');
        } else {
          document.getElementById(oposite).classList.remove('active');
          document.getElementById(oposite + '-btn').classList.remove('active')
          this.classList.add('active');
          document.getElementById(this.value).classList.add('active');
        }
      }
    }

    // Load native UI library
    var gui = require('nw.gui');

    // Get the current window
    var win = gui.Window.get();

    win.show();

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

    var log = require('../lib/logger.js')({ loglevel: 'info', nocolor: true }, weblog);

    require('../lib/main.js')(log, function (conn) {

        conn.on('setExternalIP', function (command) {
            $('#external_ip').text(command.args[0]);
        });

        conn.on('setPing', function (ping) {
            $('#ping').text(ping + 'ms');
        });

        conn.on('connect', function () {
            $('#connected').text('On');
        });

        conn.on('disconnect', function () {
            $('#connected').text('Off');
            $('#ping').text('-');
        });

        conn.command('getServerStatus', function (status) {
            $('#server-name').text(status.name);
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
            } else {
                $('#device_count').text(0);
            }
        });
    });
};
