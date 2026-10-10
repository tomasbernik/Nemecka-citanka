
const CACHE_NAME = "citanka-v125";
const IMAGE_CACHE_NAME = "citanka-article-images-v114";
const IMAGE_CACHE_LIMIT = 25;
const APP_FILES = [
  "./",
  "./index.html",
  "./theme.js?v=117",
  "./style.css?v=120",
  "./constants.js?v=125",
  "./translations/ui.js?v=125",
  "./translations/auth.js?v=117",
  "./translations/new-languages.js?v=117",
  "./translations/prompts.js?v=120",
  "./i18n.js?v=117",
  "./auth.js?v=125",
  "./api.js?v=117",
  "./profiles.js?v=117",
  "./articles.js?v=125",
  "./reader.js?v=121",
  "./games.js?v=125",
  "./editor.js?v=125",
  "./app.js?v=125",
  "./home.js?v=125",
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
    title: "Lesebuch",
    body: "Heute reichen ein paar Minuten Deutsch.",
    url: "./index.html"
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Lesebuch", {
      body: data.body || "Heute reichen ein paar Minuten Deutsch.",
      icon: "icons/icon-v2-192.png",
      badge: "icons/icon-v2-192.png",
      data: { url: data.url || "./index.html" }
    })
  );
});
