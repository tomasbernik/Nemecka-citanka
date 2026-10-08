
const CACHE_NAME = "citanka-v119";
const IMAGE_CACHE_NAME = "citanka-article-images-v114";
const IMAGE_CACHE_LIMIT = 25;
const APP_FILES = [
  "./",
  "./index.html",
  "./theme.js?v=117",
  "./style.css?v=117",
  "./constants.js?v=117",
  "./translations/ui.js?v=117",
  "./translations/auth.js?v=117",
  "./translations/new-languages.js?v=117",
  "./translations/prompts.js?v=117",
  "./i18n.js?v=117",
  "./auth.js?v=119",
  "./api.js?v=117",
  "./profiles.js?v=117",
  "./articles.js?v=117",
  "./reader.js?v=117",
  "./games.js?v=117",
  "./editor.js?v=117",
  "./app.js?v=117",
  "./home.js?v=117",
  "./config.js?v=117",
  "./articles.json",
  "./manifest.json",
  "./icons/icon-v2-192.png",
  "./icons/icon-v2-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  const keepCaches = new Set([CACHE_NAME, IMAGE_CACHE_NAME]);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => !keepCaches.has(key)).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (event.request.destination === "image") {
    event.respondWith(cacheImageRequest(event.request));
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      })
  );
});

async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const keys = await cache.keys();
  if (keys.length <= IMAGE_CACHE_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - IMAGE_CACHE_LIMIT).map(key => cache.delete(key)));
}

async function cacheImageRequest(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") {
      const copy = response.clone();
      const cache = await caches.open(IMAGE_CACHE_NAME);
      await cache.put(request, copy);
      await trimImageCache();
    }
    return response;
  } catch (error) {
    return Response.error();
  }
}

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
      icon: "icons/icon-v2-192.png",
      badge: "icons/icon-v2-192.png",
      data: { url: data.url || "./index.html" }
    })
  );
});
