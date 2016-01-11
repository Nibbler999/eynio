console.log('started', self);
self.addEventListener('install', function(e) {
  self.skipWaiting();
  console.log('installed', e);
});

self.addEventListener('active', function(e) {
  console.log('activated', e);
});

self.addEventListener('push', function(e) {
  console.log('push msg received', e);
  var title = "nHome";
  e.waitUntil(
    self.registration.showNotificatoin(title, {
      body: "The message",
      icon: "img/logo/nhome_small.png",
      tag: "my-tag"
    }));
});
