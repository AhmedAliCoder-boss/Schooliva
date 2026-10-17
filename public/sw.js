const CACHE_NAME = "schooliva-shell-v4";
const PRIVATE_CACHE_PREFIX = "schooliva-private-v1-";
const META_CACHE_NAME = "schooliva-offline-meta-v1";
const ACTIVE_SCOPE_KEY = new URL("/__schooliva_active_scope__", self.location.origin).href;
const PRIVATE_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const PRIVATE_CACHE_MAX_ENTRIES = 120;
const APP_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/brand/app-icon-192.png",
  "/brand/app-icon-512.png",
];

function isAuthRoute(pathname) {
  return ["/sign-in", "/forgot-password", "/auth/callback"].includes(pathname);
}

function isPrivatePage(pathname) {
  return pathname !== "/"
    && pathname !== "/offline.html"
    && !isAuthRoute(pathname)
    && !pathname.startsWith("/api/")
    && !pathname.startsWith("/_next/");
}

function isPublicStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/")
    || pathname.startsWith("/icons/")
    || pathname.startsWith("/brand/")
    || pathname === "/manifest.webmanifest";
}

function privateCacheName(scope) {
  return `${PRIVATE_CACHE_PREFIX}${encodeURIComponent(scope)}`;
}

async function getActiveScope() {
  const metadata = await caches.open(META_CACHE_NAME);
  const response = await metadata.match(ACTIVE_SCOPE_KEY);
  return response ? response.text() : null;
}

async function clearPrivateCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames
    .filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX) || name === META_CACHE_NAME)
    .map((name) => caches.delete(name)));
}

async function selectActiveScope(scope) {
  const currentScope = await getActiveScope();
  if (currentScope !== scope) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX))
      .map((name) => caches.delete(name)));
  }

  const metadata = await caches.open(META_CACHE_NAME);
  await metadata.put(ACTIVE_SCOPE_KEY, new Response(scope));
}

async function storePrivatePage(request, response) {
  const scope = response.headers.get("x-schooliva-offline-scope");
  if (!scope || !response.ok || !response.headers.get("content-type")?.includes("text/html")) return;

  await selectActiveScope(scope);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");
  headers.delete("vary");
  headers.set("x-schooliva-cached-at", String(Date.now()));
  const cachedResponse = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  const cache = await caches.open(privateCacheName(scope));
  await cache.put(request, cachedResponse);
  await trimPrivateCache(cache);
}

async function storePrivatePageSafely(request, response) {
  try {
    await storePrivatePage(request, response);
  } catch (error) {
    console.error("Schooliva could not store this page for offline viewing.", new URL(request.url).pathname, error);
  }
}

async function trimPrivateCache(cache) {
  const entries = await Promise.all((await cache.keys()).map(async (request) => {
    const response = await cache.match(request);
    const cachedAt = Number(response?.headers.get("x-schooliva-cached-at") ?? 0);
    return { request, cachedAt };
  }));
  const freshEntries = entries.filter((entry) => Date.now() - entry.cachedAt < PRIVATE_CACHE_MAX_AGE);
  const staleEntries = entries.filter((entry) => Date.now() - entry.cachedAt >= PRIVATE_CACHE_MAX_AGE);
  await Promise.all(staleEntries.map(({ request }) => cache.delete(request)));
  freshEntries.sort((first, second) => second.cachedAt - first.cachedAt);
  await Promise.all(freshEntries.slice(PRIVATE_CACHE_MAX_ENTRIES).map(({ request }) => cache.delete(request)));
}

async function readPrivatePage(request) {
  const scope = await getActiveScope();
  if (!scope) return null;
  const cache = await caches.open(privateCacheName(scope));
  const response = await cache.match(request);
  if (!response) return null;

  const cachedAt = Number(response.headers.get("x-schooliva-cached-at") ?? 0);
  if (!cachedAt || Date.now() - cachedAt >= PRIVATE_CACHE_MAX_AGE) {
    await cache.delete(request);
    return null;
  }
  return response;
}

async function cacheRoute(url, force = false) {
  const route = new URL(url, self.location.origin);
  if (route.origin !== self.location.origin || !isPrivatePage(route.pathname)) return;

  const request = new Request(route.href, {
    credentials: "include",
    headers: { accept: "text/html" },
    method: "GET",
  });
  if (!force) {
    const activeScope = await getActiveScope();
    if (activeScope) {
      const cache = await caches.open(privateCacheName(activeScope));
      const cachedPage = await cache.match(request);
      const cachedAt = Number(cachedPage?.headers.get("x-schooliva-cached-at") ?? 0);
      if (cachedPage && Date.now() - cachedAt < PRIVATE_CACHE_MAX_AGE) return;
    }
  }

  try {
    const response = await fetch(request);
    await storePrivatePageSafely(request, response);
  } catch (error) {
    console.warn("Schooliva could not refresh an offline page.", route.pathname, error);
  }
}

async function cacheRoutes(urls, currentUrl) {
  if (currentUrl) await cacheRoute(currentUrl, true);
  const otherRoutes = urls.filter((url) => url !== currentUrl);
  for (let index = 0; index < otherRoutes.length; index += 4) {
    await Promise.all(otherRoutes.slice(index, index + 4).map((url) => cacheRoute(url)));
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME
          && key !== META_CACHE_NAME
          && !key.startsWith(PRIVATE_CACHE_PREFIX))
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHE") {
    event.waitUntil(clearPrivateCaches());
    return;
  }
  if (event.data?.type === "CACHE_ROUTES" && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheRoutes(event.data.urls.slice(0, 80), event.data.currentUrl));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isPublicStaticAsset(url.pathname)) {
    event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
    return;
  }

  if (request.mode === "navigate" && isPrivatePage(url.pathname)) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        await storePrivatePageSafely(request, response);
        if (response.status >= 500) return await readPrivatePage(request) ?? response;
        return response;
      } catch (error) {
        console.warn("Schooliva could not load this page while offline.", url.pathname, error);
        return await readPrivatePage(request)
          ?? await caches.match("/offline.html")
          ?? Response.error();
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (
      await caches.match("/offline.html") ?? Response.error()
    )));
  }
});
