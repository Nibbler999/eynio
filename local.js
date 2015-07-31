"use strict";

var logger;

module.exports = function (l) {

    logger = l.child({component: 'Local'});

    var express = require('express');
    var ejs = require('ejs');

    var app = express();
    var server = require('http').createServer(app);

    server.listen(8080);

    app.engine('.html', ejs.__express);

    app.set('views', require('path').join(__dirname, 'local', 'views'));
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

    app.use(express.static(require('path').join(__dirname, 'local', 'public')));

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

    app.get('/stream-mjpeg/:cameraid', function (req, res) {
        streamMJPEG(req, res);
    });

    app.get('/webapi/*', function (req, res) {
        webAPI(req, res);
    });

    return server;
};

function localConnect()
{
    var io = require('./node_modules/socket.io/node_modules/socket.io-client');

    var serverUrl = 'http://127.0.0.1:8080/client';

    var serverOpts = {
        transports: ['websocket'],
        'force new connection': true
    };

    var conn = io.connect(serverUrl, serverOpts);

    return conn;
}

function streamMJPEG(request, response)
{
    var options = {
        width: -1,
        height: -1,
        framerate: -1
    };

    var cameraid = request.params.cameraid;

    var conn = localConnect();

    conn.emit('requestStreaming', cameraid, options);

    conn.once('cameraFrame', function() {
        response.set({
            'Content-Type': 'multipart/x-mixed-replace;boundary=nhome'
        });
    });

    conn.on('cameraFrame', function (frame) {
        response.write("Content-Type: image/jpeg\r\n");
        response.write("Content-Length: " + frame.image.length + "\r\n\r\n");
        response.write(frame.image);
        response.write("\r\n--nhome\r\n");
    });

    request.on('close', function () {
        conn.disconnect();
    });

    request.on('end', function () {
        conn.disconnect();
    });
}

// Convert strings to types
function fixType(value)
{
    if (value === 'false') {
        value = false;
    } else if (value === 'true') {
        value = true;
    } else if (/^[\d.]+$/.test(value)) {
        value = parseFloat(value);
    }

    return value;
}

function fixTypes(object)
{
    for (var k in object) {
        object[k] = fixType(object[k]);
    }

    return object;
}

function webAPI(req, res)
{
    var r = require('url').parse(req.url, true);

    var args = r.pathname.split('/').slice(2);
    var name = args.shift();

    args = args.map(fixType);

    if (Object.keys(r.query).length) {
        args.push(fixTypes(r.query));
    }

    var cb = function (returned) {
        res.json(returned);
        conn.disconnect();
    };

    args.unshift(name);
    args.push(cb);

    var conn = localConnect();

    conn.emit.apply(conn, args);
}

