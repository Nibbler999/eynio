
var version = require('./package.json').version;

var https = require('https');

https.get('https://neosoft-updates.s3.amazonaws.com/zupdate/NHomeServer/' + version + '.xml', function(res) {

    var updateXML = '';

    res.on('data', function(d) {
        updateXML += d;
    });

    res.on('end', function() {
        require('xml2js').parseString(updateXML, processUpdateInfo);
    });

}).on('error', function(e) {
    console.error(e);
});

function processUpdateInfo(err, info)
{
    if (!info.updates) {
        console.log('Up to date');
        require('./server.js');
        return false;
    }

    var fs = require('fs');

    var file = fs.createWriteStream('./update.zip');

    https.get(info.updates.update[0].patch[0].$.URL, function(res) {
    
        res.pipe(file);
    
        res.on('end', function() {
            console.log('Download complete');

            var AdmZip = require('adm-zip');
            
            var zip = new AdmZip('./update.zip');
            
            zip.extractAllTo('.', true);

            require('./server.js');
        });
    
    }).on('error', function(e) {
        console.error(e);
        require('./server.js');
    });
}
