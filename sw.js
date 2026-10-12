/* Reparto 1 – service worker
 * Guarda la página en el celular para que abra aunque no haya señal.
 * - La página (index.html): primero intenta bajar la versión nueva (hasta 3 s); si no hay señal, usa la guardada.
 * - Las llamadas al script de Google (datos, PIN, guardar) NUNCA se guardan acá: siempre van a internet.
 * Para forzar que todos los celulares tomen una versión nueva de este archivo, cambiar VERSION.
 */
const VERSION = "reparto1-prueba-v1";
const CORE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
const ESPERA_RED_MS = 3000;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.indexOf("reparto1-prueba-") === 0 && k !== VERSION).map(k => caches.delete(k))))   // solo borra cachés de la prueba
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                                   // POST (guardar, PIN): directo a internet
  const url = new URL(req.url);

  // Tipografías de Google: se guardan al primer uso
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(VERSION).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { c.put(req, r.clone()); return r; })))
        .catch(() => new Response("", { status: 504 }))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;                    // todo lo demás de otros sitios (script de Google): sin tocar

  // Archivos de la app: red primero (máx. 3 s), si no hay señal usa lo guardado
  e.respondWith(redPrimero(req));
});

function redPrimero(req) {
  return caches.open(VERSION).then(cache => {
    const clave = req.mode === "navigate" ? "./index.html" : req;
    const red = fetch(req).then(r => {
      if (r && r.ok) cache.put(clave, r.clone());
      return r;
    });
    const espera = new Promise(res => setTimeout(() => res(null), ESPERA_RED_MS));
    return Promise.race([red.catch(() => null), espera]).then(r =>
      r || cache.match(clave).then(hit => hit || red.catch(() => new Response("Sin conexión y la app todavía no se guardó en este celular. Abrila una vez con señal.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })))
    );
  });
}
