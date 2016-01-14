self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('active', function(e) {
});

self.addEventListener('push', function(e) {
  var date = new Date(e.timeStamp).toLocaleDateString(['ba', 'hr', 'eu']);
  var time = new Date(e.timeStamp).toLocaleTimeString(['ba', 'hr', 'eu']);
  var title = "nHome";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: "Alarm tiggered at " + date + ' @ ' + time,
      icon: "img/logo/nhome_small.png",
      tag: 'security'
    }));
});


self.addEventListener('notificationclick', function(event) {
  // Android doesn't close the notification when you click on it
  // See: http://crbug.com/463146
  event.notification.close();

  // This looks to see if the current is already open and
  // focuses if it is
  event.waitUntil(
    clients.matchAll({
      type: "window"
    })
    .then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url == '/' && 'focus' in client)
          return client.focus();
      }
      if (clients.openWindow) {
        return clients.openWindow('https://my.nhome.ba/');
      }
    })
  );
});
