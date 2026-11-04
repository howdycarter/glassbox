import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Dev-only same-origin proxy for the live Advisor call.
 *
 * WHY: the browser cannot reach api.meta.ai from every environment —
 * on proxy-only networks Chromium's direct egress fails
 * (net::ERR_TUNNEL_CONNECTION_FAILED → "Failed to fetch") while the
 * Node process reaches the API fine (its fetch honors the proxy env).
 * The API itself sends permissive CORS headers; CORS was never the
 * blocker. Routing the call same-origin through the dev server lets
 * Node perform the upstream request instead.
 *
 * SCOPE / SAFETY:
 * - configureServer runs ONLY under `vite dev`; production builds
 *   are untouched and the app keeps calling the API directly there.
 * - The API key is attached HERE, server-side, from the process env
 *   or .env.local read by loadEnv with an empty prefix (server-side
 *   only — loadEnv values are never inlined into client code). Any
 *   Authorization header the client sends is ignored. The key is
 *   never logged.
 * - Honesty semantics are unchanged: the proxy is a dumb pipe. The
 *   app still labels an exchange 'live' only when a real API reply
 *   returns through it and parses; a proxy/upstream failure returns
 *   a non-2xx status and the ladder degrades to disclosed cache
 *   exactly as it does for a direct-call failure.
 */
function advisorLiveProxy(apiKey: string): Plugin {
  return {
    name: 'advisor-live-proxy',
    configureServer(server) {
      server.middlewares.use('/__advisor/chat/completions', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        if (!apiKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: { message: 'no Meta Model API key configured server-side' } }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          void (async () => {
            try {
              const upstream = await fetch('https://api.meta.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: Buffer.concat(chunks).toString('utf8'),
                signal: AbortSignal.timeout(30_000),
              });
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(text);
            } catch {
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { message: 'advisor proxy upstream call failed' } }));
            }
          })();
        });
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const advisorKey =
    process.env.META_MODEL_API_KEY || env.META_MODEL_API_KEY || env.VITE_META_MODEL_API_KEY || '';
  return {
    plugins: [react(), tailwindcss(), advisorLiveProxy(advisorKey)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
