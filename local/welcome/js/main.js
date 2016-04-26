// all DOM states
var states = document.querySelectorAll('.state-wrap');
var stateBtns = document.querySelectorAll('.nav-state-btn');
var nav = document.querySelector('.nav-menu');
var navBtn = document.querySelector('.nav-icon');
/**
 * @name _changeState
 * @desc toggle state visibitly
 * @type {functoin}
 * @param (state to show)
 */
function _changeState(state) {
    for (var i = 0; i < states.length; i++) {
        if (states[i].dataset.state === state) {
            states[i].hidden = false;
            stateBtns[i].classList.add('active');
        } else {
            states[i].hidden = true;
            stateBtns[i].classList.remove('active');
        }
    }
}

// listen for state changes
window.addEventListener('hashchange', function(e) {
    _changeState(e.newURL.split('#')[1])
}, false);

// put user in last state
if(window.location.href.split('#')[1]){
  _changeState(window.location.href.split('#')[1]);
}

// toggle nav menu on small devices
navBtn.addEventListener('click', function(e){
  nav.classList.toggle('toggled');
},false);

if (window.nw) {
    $('#open_local_mode').attr('href', 'http://127.0.0.1:38736/');
}

var url = window.nw ? 'http://127.0.0.1:38736/sse' : '/sse';

var sse = $.SSE(url, {
	onMessage: function (event) { 

        var message = $.parseJSON(event.data);

        switch (message.type) {

            case 'server-status':

                $('#server_name').text(message.value.name);
                $('#ping').text(message.value.ping + 'ms');
                $('#ip').text(message.value.ip);
                $('#external_ip').text(message.value.external_ip);
                $('#version').text(message.value.version);
                $('#node_version').text(message.value.node_version);
                $('#node_platform').text(message.value.node_platform);
                $('#node_arch').text(message.value.node_arch);

                break;

            case 'full-log':

                $('#terminal').text(message.value);

                break;

            case 'conn-connected':

                $('#connected').text(message.value ? 'Connected' : 'Disconnected');

                break;

            case 'conn-ping':

                $('#ping').text(message.value + 'ms');

                break;

            case 'server-ip':

                $('#external_ip').text(message.value);

                break;
        }
	}
});

sse.start();

