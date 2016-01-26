var IDBServerData, IDBUserData, IDBUser;
var IDBDataObj = {};

// self.clients.matchAll().then(function(clients) {
//   clients.forEach(function(client) {
//     console.log(client);
//     client.postMessage('The service worker just started up.');
//   });
// });
// console.log(self.clients);
self.addEventListener('install', function(e) {

  self.skipWaiting();
  console.log(e);
  console.log('SW INSTALL');

  //console.log(socket);

  // event.waitUntil(
  //   caches.open('storePage00').then(function(cache){
  //     return cache.addAll([
  //       'index.html',
  //       'css/',
  //       'js/',
  //       'directive/',
  //       'fonts/',
  //       'html_route/',
  //       'img/'
  //     ]);
  //   })
  // )
});

// self.addEventListener('fetch', function(event) {
// console.log(event);
//   var response;
//
//   event.respondWith(caches.match(event.request).catch(function() {
//     return fetch(event.request);
//   }).then(function(r) {
//     response = r;
//     caches.open('storePage00').then(function(cache) {
//       cache.put(event.request, response);
//     });
//     return response.clone();
//   }).catch(function() {
//     console.log('error Cache');
//   }));
//  });

self.addEventListener('activate', function(e) {
  console.log(e);
  console.log('SW ACTIVE');

  //openDB('last_user', 1, 'user');
});

self.addEventListener('message', function(e) {
  console.log(e);
  e.ports[0].postMessage(IDBDataObj);
  // if (e.data.email === IDBUser.email) {
  //   console.log('SEND MSGG');
  //   e.ports[0].postMessage(IDBDataObj);
  // }
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



function openDB(db, dbV, objStore) {
  var req = indexedDB.open(db, dbV);

  req.onsuccess = function(e) {
    console.log('SUCCESS', e);

    if (e.target.result.name === 'last_user') {
      IDBUserData = e.target.result;
      getDB(IDBUserData, 'user', 'last');
    } else {
      IDBServerData = e.target.result;
      getDB(IDBServerData, IDBUser.lastServerId, 'getCategories');
      getDB(IDBServerData, IDBUser.lastServerId, 'getDevices');
      getDB(IDBServerData, IDBUser.lastServerId, 'getScenes');
      getDB(IDBServerData, IDBUser.lastServerId, 'getSchedules');
      getDB(IDBServerData, IDBUser.lastServerId, 'getRecordings');
    }
  };

  req.onerror = function(e) {
    console.log('DB error', e.target.errorCode);
  };

  req.onupgradeneeded = function(e) {
    var store;
    if (typeof objStore === 'object') {
      angular.forEach(objStore, function(server) {
        store = e.target.result.createObjectStore(server.id);
      })
    } else if (typeof objStore === 'string') {
      store = e.target.result.createObjectStore(objStore);
    }
  };
};

function putDB(idb, objStore, objStoreKey, data) {
  var transaction = idb.transaction(objStore, 'readwrite');

  // transaction.oncomplete = function(e) {
  //   console.log(e);
  // };
  //
  // transaction.onerror = function(e) {
  //   console.log(e);
  // };

  var objectStore = transaction.objectStore(objStore).put(data, objStoreKey);
  objectStore.onsuccess = function(e) {
    console.log(e);
  };

  objectStore.onerror = function(e) {
    console.log('ERROR');
    console.log(e);
  };
};

function getDB(idb, objStore, objStoreKey) {
  var req = idb.transaction(objStore).objectStore(objStore).get(objStoreKey);

  req.onerror = function(e) {
    console.log(e);
  };

  req.onsuccess = function(e) {
    switch (objStoreKey) {
      case 'getDevices':
        IDBDataObj.allDev = e.target.result;
        break;
      case 'getCategories':
        IDBDataObj.allCategories = e.target.result;
        break;
      case 'getScenes':
        IDBDataObj.allScenes = e.target.result;
        break;
      case 'getSchedules':
        IDBDataObj.allSchedules = e.target.result;
        break;
      case 'getRecordings':
        IDBDataObj.allRecordings = e.target.result;
        console.log(IDBDataObj);
        break;
      case 'last':
        IDBUser = e.target.result;
        console.log(e);
        console.log(IDBUser);
        openDB(IDBUser.email, IDBUser.servers.length, IDBUser.servers);
        break;
    }
  };
};
