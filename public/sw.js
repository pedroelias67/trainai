const CACHE_VERSION = "trainai-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Pages to pre-cache on install
const PRECACHE_URLS = [
  "/dashboard",
  "/dashboard/plan",
  "/dashboard/nutrition",
  "/dashboard/activities",
  "/dashboard/fitness",
  "/auth/login",
  "/offline",
];

// API routes to cache with network-first strategy
const API_CACHE_PATTERNS = [
  /\/api\/wellness/,
  /\/api\/athletes\/profile/,
];

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for pages, network-first for API ───────────
self.addEventListener("fetch", e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Skip Next.js internals
  if (url.pathname.startsWith("/_next/")) {
    e.respondWith(
      caches.match(request).then(cached =>
        cached ?? fetch(request).then(r => {
          if (r.ok) caches.open(STATIC_CACHE).then(c => c.put(request, r.clone()));
          return r;
        })
      )
    );
    return;
  }

  // API: network-first, fall back to cache
  if (url.pathname.startsWith("/api/")) {
    const shouldCache = API_CACHE_PATTERNS.some(p => p.test(url.pathname));
    e.respondWith(
      fetch(request)
        .then(r => {
          if (r.ok && shouldCache) {
            caches.open(DYNAMIC_CACHE).then(c => c.put(request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Pages and RSC payloads: network-first. These are per-athlete and change after
  // every sync, so serving a stale copy shows yesterday's data until a reload.
  // The cache is kept purely as an offline fallback.
  e.respondWith(
    fetch(request)
      .then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(DYNAMIC_CACHE).then(c => c.put(request, copy));
        }
        return r;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const offline = await caches.match("/offline");
        return offline ?? new Response("Offline", { status: 503 });
      })
  );
});

// ── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener("sync", e => {
  if (e.tag === "sync-wellness") {
    e.waitUntil(syncPendingWellness());
  }
  if (e.tag === "sync-sessions") {
    e.waitUntil(syncPendingSessions());
  }
});

async function syncPendingWellness() {
  const db = await openDB();
  const pending = await db.getAll("pending-wellness");
  for (const item of pending) {
    try {
      const r = await fetch("/api/wellness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      if (r.ok) await db.delete("pending-wellness", item.id);
    } catch {}
  }
}

async function syncPendingSessions() {
  const db = await openDB();
  const pending = await db.getAll("pending-sessions");
  for (const item of pending) {
    try {
      const r = await fetch(`/api/sessions/${item.data.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      if (r.ok) await db.delete("pending-sessions", item.id);
    } catch {}
  }
}

// Minimal IndexedDB helper
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("trainai-offline", 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pending-wellness"))
        db.createObjectStore("pending-wellness", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("pending-sessions"))
        db.createObjectStore("pending-sessions", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = e => {
      const db = e.target.result;
      resolve({
        getAll: store => new Promise((res, rej) => {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).getAll();
          req.onsuccess = () => res(req.result);
          req.onerror = () => rej(req.error);
        }),
        delete: (store, id) => new Promise((res, rej) => {
          const tx = db.transaction(store, "readwrite");
          const req = tx.objectStore(store).delete(id);
          req.onsuccess = () => res();
          req.onerror = () => rej(req.error);
        }),
      });
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", e => {
  const data = e.data?.json() ?? { title: "TrainAI", body: "Nova notificação" };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/api/icon/192",
      badge: "/api/icon/192",
      vibrate: [100, 50, 100],
      data: { url: data.url ?? "/dashboard" },
      actions: [{ action: "open", title: "Ver" }],
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window" }).then(wins => {
      const url = e.notification.data.url;
      const existing = wins.find(w => w.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
