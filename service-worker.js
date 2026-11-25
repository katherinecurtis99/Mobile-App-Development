const CACHE = "budgetbanquet-v1";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.json", "icon-192.png", "icon-512.png"];

// Install
self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE)
            .then(function (cache) { return cache.addAll(FILES); })
            .then(function () { return self.skipWaiting(); })
    );
});

// Activate
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (names) {
                return Promise.all(names.filter(function (n) { return n !== CACHE; })
                    .map(function (n) { return caches.delete(n); }));
            })
            .then(function () { return self.clients.claim(); })
    );
});

// Fetch - work offline
self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET" || !event.request.url.startsWith("http")) {
        return;
    }
    event.respondWith(
        fetch(event.request)
            .then(function (response) {
                const copy = response.clone();
                caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
                return response;
            })
            .catch(function () {
                return caches.match(event.request).then(function (cached) {
                    return cached || caches.match("index.html");
                });
            })
    );
});