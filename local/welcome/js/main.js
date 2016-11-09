var btns = document.querySelectorAll('.nav-button');
var content = document.querySelector('.content');

for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener('click', function(e) {
        removeActiveClass();
        if (e.target.name === 'info') {
            content.classList.add('roll');
            e.target.classList.add('active');
        } else {
            content.classList.remove('roll');
            e.target.classList.add('active');
        }
    }, false);
}

function removeActiveClass() {
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
}
if (window.nw) {
    $('#open_local_mode').attr('href', 'http://127.0.0.1:38736/');
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

                break;

            case 'full-log':

                $('#terminal').text(message.value);

                break;

            case 'conn-connected':

                $('#connection').text(message.value ? 'Connected' : 'Disconnected');

                break;

            case 'conn-ping':

                $('#ping').text(message.value + 'ms');

                break;

            case 'server-ip':

                $('#ip_ext').text(message.value);

                break;
        }
	}
});

sse.start();

