"use strict";

window.onload = function() {

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

        // Bind a callback to item
        var item = new gui.MenuItem({
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

    var path = require('path'), cp = require('child_process');

    var child;

    var nodePath = 'node';

    var cwd = path.dirname(process.execPath);

    if (process.platform === 'win32') {
        nodePath = path.join(cwd, 'node.exe');
    }

    function spawnChild () {
        child = cp.spawn(nodePath, ['update.js']);
        child.on('exit', spawnChild);
    };

    spawnChild();

    win.on('close', function () {
        child.removeListener('exit', spawnChild);
        child.kill();
        win.close(true);
    });
};
