document.getElementById('claimServer').onclick = function(){
    document.getElementById("welcome").style.display = "none";
    document.querySelector('main').style.display = 'block';
}

function removeActiveClass(elems,className){
    Array.prototype.forEach.call(elems, function(elem){
	    elem.classList.remove(className);
    });
}

var navItem = document.querySelectorAll('aside li'),
    templates = document.querySelectorAll('.template');

Array.prototype.forEach.call(navItem, function(elem){
    elem.onclick = function(e){
	    if(!this.classList.contains('activeNav')){
		    var temp = this.getAttribute('data-template');
		    removeActiveClass(navItem,'activeNav');
		    removeActiveClass(templates,'activeTemplate');
		    this.classList.add('activeNav');
		    document.getElementById(temp).classList.add('activeTemplate');
		    document.getElementById('navLogo').src = 'img/' + temp + '.png';
	    }
    }
});

var navLog = document.querySelectorAll('#logs h3'),
    logTemplates = document.querySelectorAll('.logTemplate');

Array.prototype.forEach.call(navLog, function(elem){
    elem.onclick = function(e){
	    if(!this.classList.contains('activeNavLog')){
		    var temp = this.getAttribute('data-template');
		    removeActiveClass(navLog,'activeNavLog');
		    removeActiveClass(logTemplates,'activeTemplateLog');
		    this.classList.add('activeNavLog');
		    document.getElementById(temp).classList.add('activeTemplateLog');
	    }
    }
});

if (window.nw) {

    $('#reboot').show().click(function () {
        window.parent.reboot();
        $('#status').removeClass('online').addClass('offline');
    });
}

var url = window.nw ? 'http://127.0.0.1:38736/sse' : '/sse';

var sse = $.SSE(url, {
    onMessage: function (event) { 

        var message = $.parseJSON(event.data);

        switch (message.type) {

            case 'server-status':

                $('#ping').text(message.value.ping + 'ms');
                $('#ip_int').text(message.value.ip);
                $('#ip_ext').text(message.value.external_ip);
                $('#server_v').text(message.value.version);
                $('#node_v').text(message.value.node_version);
                $('#os').text(message.value.node_platform);
                $('#arch').text(message.value.node_arch);
                $('#name, #info-name').text(message.value.name);
                $('#autoupdate').text(message.value.autoupdate ? 'Yes' : 'No');
                $('#updateable').text(message.value.updateable ? 'Yes' : 'No');
                $('#local').text(message.value.local ? 'Yes' : 'No');

                if (message.value.regdate) {
                    $('#regdate').text((new Date(message.value.regdate)).toDateString());
                }

                break;

            case 'full-log':

                $('#terminal').text(message.value);

                break;

            case 'conn-connected':

                $('#status').removeClass('online offline').addClass(message.value ? 'online' : 'offline');

                break;

            case 'conn-ping':

                $('#ping').text(message.value + 'ms');

                break;

            case 'server-ip':

                $('#ip_ext').text(message.value);

                break;

            case 'claim':

                if (!message.value.claimed) {
                    $('#welcome').show();
                    $('main').hide();
                }

                break;

            case 'action-log':

                if (message.value.length > 0) {

                    var dayDiv = $('<div class="dayDiv" />');

                    var h4 = $('<h4 class="date" />').text(formatDate(message.value[0].time));
                    dayDiv.append(h4);

                    message.value.forEach(function (entry) {

                        var ptime = $('<p class="time"></p>').text(formatTime(entry.time));
                        dayDiv.append(ptime);

                        var pmessage = $('<p class="message"></p>').text(entry.user + ' ' + log_description(entry.action) + ' ' + entry.device);
                        dayDiv.append(pmessage);
                    });

                    $('#latestActions').empty().append(dayDiv);
                }

                break;
        }
    }
});

sse.start();

function log_description(action)
{
    var desc = {
        'light-on': 'turned on light',
        'light-off': 'turned off light',
        'switch-on': 'switched on',
        'switch-off': 'switched off',
        'shutter-open': 'opened shutter',
        'shutter-close': 'closed shutter',
        'thermostat-set': 'set thermostat',
        'scene-set': 'set scene'
    };

    return desc[action] || '';
}

function pad(number)
{
    return number > 9 ? number : '0' + number;
}

function formatDate(timestamp)
{
    var d = new Date(timestamp);

    return d.toDateString();
}

function formatTime(timestamp)
{
    var d = new Date(timestamp);

    return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

