const CACHE_NAME = "emab-erp-v2-dev-reset";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = ["/offline.html", "/icon.svg", "/manifest.json"];

// v2 : purge complète + auto-désinscription. Un service worker cache-first
// enregistré pendant le développement servait des chunks JS périmés après
// chaque redémarrage du serveur, ce qui cassait silencieusement les clics
// côté client (React ne plantait pas visiblement, il n'attachait juste plus
// les bons handlers). PWARegister.tsx ne s'enregistre plus qu'en production ;
// ce bloc nettoie les installations existantes des navigateurs déjà touchés.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) client.navigate(client.url);
    })()
  );
});

// Stratégie : "network first, fallback cache" pour la navigation (les
// données métier doivent rester fraîches), "cache first" pour les
// ressources statiques (JS/CSS/images) — jamais l'API Supabase, qui
// gère elle-même son propre cache/realtime.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((res) => res ?? Response.error()))
    );
    return;
  }

  if (request.destination === "style" || request.destination === "script" || request.destination === "image") {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});

// Notifications push (Web Push API) — voir lib/notifications/push.ts
// côté serveur pour l'envoi.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const payload = event.data.json();

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "EMAB ERP", {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: payload.url ?? "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(self.clients.openWindow(url));
});
