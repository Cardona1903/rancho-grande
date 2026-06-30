const CACHE_NAME = 'ranchgrande-v2';

const RECURSOS_ESTATICOS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/supabase.js',
  '/js/notificaciones.js',
  '/js/offline.js',
  '/js/calendario.js',
  '/js/habitaciones.js',
  '/js/arrendatarios.js',
  '/js/aseo.js',
  '/js/finanzas.js',
  '/js/exportar.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(RECURSOS_ESTATICOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((respuestaRed) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, respuestaRed.clone());
          return respuestaRed;
        });
      })
      .catch(() => caches.match(event.request))
  );
});
