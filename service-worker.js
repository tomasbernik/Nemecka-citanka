
const CACHE_NAME = "citanka-v107";
const APP_FILES = [
  "./",
  "./index.html",
  "./theme.js?v=107",
  "./style.css?v=107",
  "./constants.js?v=107",
  "./translations/ui.js?v=107",
  "./translations/auth.js?v=107",
  "./translations/new-languages.js?v=107",
  "./translations/prompts.js?v=107",
  "./i18n.js?v=107",
  "./auth.js?v=107",
  "./api.js?v=107",
  "./profiles.js?v=107",
  "./articles.js?v=107",
  "./reader.js?v=107",
  "./games.js?v=107",
  "./editor.js?v=107",
  "./app.js?v=107",
  "./home.js?v=107",
  "./config.js?v=107",
  "./articles.json",
  "./manifest.json",
  "./icons/icon-v2-192.png",
  "./icons/icon-v2-512.png",
  "./images/articles/wohin-fahren-wir-dieses-jahr.jpg",
  "./images/articles/vor-dem-urlaub-chaos-mit-plan.jpg",
  "./images/articles/tomas-lernt-eine-lustige-eiersuppe-zu-kochen.jpg",
  "./images/articles/spaziergang-am-see.jpg",
  "./images/articles/reise-suedspanien.jpg",
  "./images/articles/paris-ein-tag.jpg",
  "./images/articles/nachmittag-baggersee-tomas.jpg",
  "./images/articles/kleines-fruehstueck.jpg",
  "./images/articles/garten-nachmittag-kika.jpg",
  "./images/articles/einkaufen-bei-temu.jpg",
  "./images/articles/ein-sehr-gro-es-fruhstuck-am-samstag.jpg",
  "./images/articles/ein-lustiger-fahrradausflug-zur-rheininsel.jpg",
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
  if (event.request.method !== "GET") return;

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
