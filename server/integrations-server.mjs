import http from 'node:http';
import { createRouter, handleRouteError } from './prediction/router.mjs';
import { readDb, writeDb } from './prediction/storage.mjs';
import { json } from './prediction/utils.mjs';

const PORT = Number(process.env.INTEGRATIONS_PORT ?? 8787);
const MASTER_KEY = process.env.INTEGRATIONS_MASTER_KEY
  ?? (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-master-key');

const route = createRouter({ masterKey: MASTER_KEY, readDb, writeDb });

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    const handled = await route(req, res, url.pathname);
    if (handled !== false) return;
    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

server.listen(PORT, () => {
  console.log(`Prediction market integrations API listening on :${PORT}`);
});
