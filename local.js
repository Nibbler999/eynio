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

    app.use(express['static']('local/public'));

    app.get('/', function (req, res) {
        res.render('dashboard_view');
    });

    app.get('/dashboard', function (req, res) {
        res.render('dashboard_view');
    });

    app.get('/schedule', function (req, res) {
        res.render('schedule_view');
    });

    app.get('/devices', function (req, res) {
        res.render('devices_view');
    });

    app.get('/support', function (req, res) {
        res.render('support_view');
    });

    app.get('/downloads', function (req, res) {
        res.render('downloads_view');
    });

    app.get('/security', function (req, res) {
        res.render('security_view');
    });

    return server;
};
