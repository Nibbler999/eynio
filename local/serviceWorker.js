var CACHE_VERSION = 1;

// Shorthand identifier mapped to specific versioned cache.
var CURRENT_CACHES = {
  img: 'img-cache-v' + CACHE_VERSION,
  other: 'offline-cache-v' + CACHE_VERSION,
  js: 'js-cache-v' + CACHE_VERSION
};

function addToCache(req, resp, cacheType) {
  if (resp.ok) {
    var copy = resp.clone();
    console.log(cacheType, req);
    caches.open(cacheType + CACHE_VERSION)
      .then(function(cache) {
        cache.put(req, copy)
      })
    return resp
  }
}

function getFromCache(req) {
  return caches.match(req)
    .then(function(response) {
      console.log(response);
      if (!response) {
        throw Error('NEMA KEŠA')
      }
      return response
    });
}

self.addEventListener('install', function(event) {
  console.log('SW INSTALL');

  // event.waitUntil(
  //   caches.open('offline-v' + CACHE_VERSION)
  //   .then(function(cache) {
  //     return cache.addAll([
  //       'index.html'
  //       'img/favicon.ico',
  //       'img/login-bg.png',
  //       'img/device/alarm-off.png',
  //       'img/device/alarm-on.png',
  //       'img/device/camera.png',
  //       'img/device/light-off.png',
  //       'img/device/light-on.png',
  //       'img/device/remote.png',
  //       'img/device/scene-icon.png',
  //       'img/device/shutter-off.png',
  //       'img/device/shutter-on.png',
  //       'img/device/switch-off.png',
  //       'img/device/switch-on.png',
  //       'img/device/thermostat.png',
  //       'img/remote-icons/chevron-down.png',
  //       'img/remote-icons/chevron-left.png',
  //       'img/remote-icons/chevron-right.png',
  //       'img/remote-icons/chevron-up.png',
  //       'img/remote-icons/learning-mode.png',
  //       'img/remote-icons/menu.png',
  //       'img/remote-icons/minus.png',
  //       'img/remote-icons/numpad.png',
  //       'img/remote-icons/plus.png',
  //       'img/remote-icons/power.png',
  //       'img/remote-icons/source.png',
  //       'js/libraries/angular.min.js',
  //       'js/libraries/angular-ui-router.min.js',
  //       'js/libraries/bootstrap.js',
  //       'js/libraries/jquery-1.11.3.min.js',
  //       'js/libraries/npm.js',
  //       'js/libraries/socket.io.js',
  //       'js/factory/socket.js'
  //     ]);
  //   })
  // );
});

// when fetching resorces store in cache
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var imgReq = request.url.match(/nhomeba\/ js\/factory | js\/libraries | directive\/devices /i);

  // if (imgReq) {
  //   event.respondWith(
  //     getFromCache(request)
  //     .catch(function() {
  //       return fetch(request)
  //         .then(function(response) {
  //           console.log('nema u kesu, fečam');
  //           return addToCache(request, response, 'img-cache-v')
  //         })
  //     })
  //   );
  // } else {
  //   event.respondWith(
  //     fetch(request)
  //     .then(function(response) {
  //       console.log('fečo sam, stavljam u keš');
  //       return addToCache(request, response, 'offline-cache-v');
  //     })
  //     .catch(function() {
  //       console.log('probo feč, nije išlo, mozda ima u kešu');
  //       return getFromCache(request);
  //     })
  //   );
  // }
});

self.addEventListener('activate', function(event) {
  caches.keys().then(function(cacheKeys) {
    console.log(cacheKeys);
  })
});

// recive message
self.addEventListener('message', function(e) {
  console.log(e);
  e.ports[0].postMessage(IDBDataObj);
});

// GCM push notifications
self.addEventListener('push', function(e) {
  console.log(e);
  var date = new Date(e.timeStamp).toLocaleDateString(['ba', 'hr', 'eu']);
  var time = new Date(e.timeStamp).toLocaleTimeString(['ba', 'hr', 'eu']);
  var title = "nHome";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: "Alarm tiggered on " + date + ' @ ' + time,
      icon: "img/logo/nhome_small.png",
      tag: 'security'
    }));
});

// click on notifications popUp
self.addEventListener('notificationclick', function(event) {
  // Android doesn't close the notification when you click on it
  // See: http://crbug.com/463146
  event.notification.close();

  // self looks to see if the current is already open and
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
