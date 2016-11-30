"use strict";

// Load native UI library
var gui = require('nw.gui');

// Get the current window
var win = gui.Window.get();

window.onload = function() {

    if (gui.App.argv.indexOf('--autostart') !== -1) {

        // Create a tray icon
        var tray = new nw.Tray({ title: 'EynioServer', icon: 'nwjs/img/tray.png' });

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

    var cp = require('child_process');

    var nodePath = 'node';

    var opts = {};

    if (process.platform === 'win32') {
        var path = require('path');
        var cwd = path.dirname(process.execPath);
        nodePath = path.join(cwd, 'node.exe');
        opts.stdio = 'ignore';
    } else {
        opts.stdio = 'inherit';
    }

    var child;

    var args = ['server.js'].concat(gui.App.argv);

    function spawnChild () {
        child = cp.spawn(nodePath, args, opts);
        child.on('exit', spawnChild);
    }

    spawnChild();

    win.on('close', function () {
        child.removeListener('exit', spawnChild);
        child.kill();
        win.close(true);
    });
};
