const CACHE_NAME = "schooliva-shell-v1";
const APP_SHELL = [
  "/",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isPrivateSupabaseRequest = url.pathname.includes("supabase") || url.hostname.includes("supabase");
  const isAuthRoute = ["/sign-in", "/forgot-password", "/reset-password"].includes(url.pathname);
  const isPublicStaticAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".png") || url.pathname.endsWith(".jpg") || url.pathname.endsWith(".webp");

  if (isPrivateSupabaseRequest || url.pathname.startsWith("/api") || url.pathname.startsWith("/auth") || /\/dashboard|\/profile|\/students|\/teachers|\/parents|\/finance|\/results|\/timetable|\/attendance|\/documents|\/notifications|\/audit|\/reports|\/search/.test(url.pathname)) {
    return;
  }

  if (isPublicStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/") || caches.match("/sign-in")),
    );
    return;
  }

  if (isAuthRoute) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }
});
