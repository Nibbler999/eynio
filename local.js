"use strict";

var logger;

module.exports = function (l) {

    logger = l.child({component: 'Local'});

    var express = require('express');
    var ejs = require('ejs');

    var app = express();
    var server = require('http').Server(app);

    server.listen(8080);

    app.engine('.html', ejs.__express);

    app.set('views', 'local/views');
    app.set('view engine', '.html');

    app.use(function (req, res, next) {

        var ip = req.ip.replace(/^::ffff:/, '');

        if (!require('ip').isPrivate(ip)) {
            res.status(403).send('Access via local network IP only');
            res.end();
        } else {
            next();
        }
    });

    app.use(express['static']('local/public'));

    var locals = {
        page: '',
        menu: {
            dashboard: 'Dashboard',
            schedule:  'Schedule',
            devices:   'Devices',
            downloads: 'Downloads',
            support:   'Support',
            security:  'Security'
        }
    };

    app.get('/', function (req, res) {
        locals.page = 'dashboard';
        res.render('dashboard_view', locals);
    });

    app.get('/dashboard', function (req, res) {
        locals.page = 'dashboard';
        res.render('dashboard_view', locals);
    });

    app.get('/schedule', function (req, res) {
        locals.page = 'schedule';
        res.render('schedule_view', locals);
    });

    app.get('/devices', function (req, res) {
        locals.page = 'devices';
        res.render('devices_view', locals);
    });

    app.get('/downloads', function (req, res) {
        locals.page = 'downloads';
        res.render('downloads_view', locals);
    });

    app.get('/support', function (req, res) {
        locals.page = 'support';
        res.render('support_view', locals);
    });

    app.get('/security', function (req, res) {
        locals.page = 'security';
        res.render('cam_view', locals);
    });

    return server;
};
