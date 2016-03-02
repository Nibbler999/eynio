window.onload = function() {

    $('.sidebar-btn').click(function() {
   
        $('.sidebar-btn').removeClass('active');
        $(this).addClass('active');

        $('.tab').removeClass('active');
        $('#' + $(this).val()).addClass('active');
    });

    // Load native UI library
    var gui = require('nw.gui');

    // Get the current window
    var win = gui.Window.get();

    if (gui.App.argv.indexOf('--autostart') !== -1) {

        // Create a tray icon
        var tray = new nw.Tray({ title: 'NHomeServer', icon: 'nwjs/img/tray.png' });
    
        tray.on('click', function() {
            win.show();
        });
        
        // Or you can omit the 'type' field for normal items
        var item = new gui.MenuItem({ label: 'Simple item' });

        // Bind a callback to item
        item = new gui.MenuItem({
            label: "Exit",
            click: function() {
                win.close();
            }
        });

        var menu = new gui.Menu();
        menu.append(item);
        tray.menu = menu;

        win.setShowInTaskbar(false);
         
    } else {
        win.show();
    }

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

        $('#localframe').attr('src', 'http://127.0.0.1:8008/');

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
