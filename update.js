
var version = require('./package.json').version,
    name = require('./package.json').name;

var https = require('https');

https.get('https://neosoft-updates.s3.amazonaws.com/zupdate/' + name + '/' + version + '.xml', function(res) {

    console.log('Checking for updates');

    var updateXML = '';

    res.on('data', function(d) {
        updateXML += d;
    });

    res.on('end', function() {
        if (res.statusCode === 200) {
            require('xml2js').parseString(updateXML, processUpdateInfo);
        } else {
            console.error('Failed to download update info:', res.statusCode);
            require('./server.js');
        }
    });

}).on('error', function(e) {
    console.error(e);
    require('./server.js');
});

function processUpdateInfo(err, info)
{
    if (err) {
        console.error('Failed to parse XML:', err);
        require('./server.js');
        return false;
    }

    if (!info.updates) {
        console.log('Up to date');
        require('./server.js');
        return false;
    }

    var fs = require('fs');
    var zipfilename = 'update.zip';

    var file = fs.createWriteStream(zipfilename);

    https.get(info.updates.update[0].patch[0].$.URL, function(res) {
    
        console.log('Downloading update');

        res.pipe(file);
    
        res.on('end', function() {
            console.log('Download complete');

            var AdmZip = require('adm-zip');
            
            var zip = new AdmZip(zipfilename);
            
            console.log('Applying update');

            zip.extractAllTo('.', true);

            fs.unlink(zipfilename);

            console.log('Update complete');

            require('./server.js');
        });
    
    }).on('error', function(e) {
        console.error(e);
        require('./server.js');
    });
}
