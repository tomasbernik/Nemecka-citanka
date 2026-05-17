
const CACHE_NAME = "citanka-v54";
const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./articles.json",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/articles/wohin-fahren-wir-dieses-jahr.jpg",
  "./images/articles/ein-lustiger-einkauf-im-urlaub.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "./index.html", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const existingClient = clientList.find(client => client.url.startsWith(self.location.origin));
      if (existingClient) {
        return existingClient.focus();
      }

      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("push", event => {
  const data = event.data?.json?.() || {
    title: "Čítanka",
    body: "Dnes stačí pár minút nemčiny.",
    url: "./index.html"
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Čítanka", {
      body: data.body || "Dnes stačí pár minút nemčiny.",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      data: { url: data.url || "./index.html" }
    })
  );
});
