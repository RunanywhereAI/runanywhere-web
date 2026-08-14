/**
 * Cross-Origin Isolation Service Worker
 *
 * Enables SharedArrayBuffer when the static host cannot provide COOP/COEP
 * response headers. This is required for multi-threaded WASM (pthreads).
 *
 * How it works:
 * - Intercepts navigation responses and injects COOP + COEP headers
 * - Intercepts cross-origin responses and injects CORP header
 * - On first install, claims all clients so it activates immediately
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    // Navigation requests (HTML pages): inject COOP + COEP headers
    event.respondWith(
      fetch(request).then((response) => {
        // A production host may already provide the exact isolation contract.
        // Preserve that response byte-for-byte instead of rebuilding its body:
        // WebKit can otherwise retain a legacy controlled navigation as an
        // empty page when the host migrates from credentialless to require-corp.
        if (
          response.headers.get('Cross-Origin-Opener-Policy') === 'same-origin'
          && response.headers.get('Cross-Origin-Embedder-Policy') === 'require-corp'
        ) {
          return response;
        }

        const headers = new Headers(response.headers);
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      })
    );
  } else if (request.url.startsWith(self.location.origin)) {
    // Same-origin requests: pass through unchanged
    return;
  } else {
    // Cross-origin requests: re-fetch and inject CORP header
    // Clone the complete Request so Range/conditional headers used by
    // resumable model downloads survive the isolation fallback. Rebuilding
    // from request.url alone silently turns every resume into a full fetch.
    const isolatedRequest = new Request(request, { credentials: 'omit' });
    event.respondWith(
      fetch(isolatedRequest)
        .then((response) => {
          const headers = new Headers(response.headers);
          headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        })
        .catch(() => fetch(request))
    );
  }
});
