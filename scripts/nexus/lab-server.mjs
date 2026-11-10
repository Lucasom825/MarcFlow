#!/usr/bin/env node
// NEXUS 059: local, read-only browser test bench. Never bind to external addresses.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { convertDrawflowToMarcFlow } from './drawflow-converter.mjs';
import { verifyPreview } from './verify-preview.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.NEXUS_LAB_PORT || 48959);
const MAX = 500_000;
const here = name => new URL(name, import.meta.url);
const respond = (res, status, data, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  });
  res.end(data);
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/lab.js' || url.pathname === '/fixture')) {
      const file = url.pathname === '/' ? 'lab.html' :
        url.pathname === '/lab.js' ? 'lab.js' : 'exemplo-drawflow-anotado.json';
      const path = here(file);
      if ((await stat(path)).size > MAX) throw new Error('Arquivo de bancada acima do limite.');
      const type = file.endsWith('.html') ? 'text/html; charset=utf-8' :
        file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/json; charset=utf-8';
      return respond(res, 200, await readFile(path), type);
    }
    if (req.method === 'GET' && url.pathname === '/health') {
      return respond(res, 200, JSON.stringify({ ok: true, mode: 'read-only-lab' }));
    }
    if (req.method === 'POST' && url.pathname === '/api/preview') {
      const expected = `http://${HOST}:${PORT}`;
      if (req.headers.origin !== expected || req.headers['x-nexus-lab'] !== '1' ||
          !String(req.headers['content-type'] || '').startsWith('application/json')) {
        return respond(res, 403, JSON.stringify({ error: 'Local origin and JSON request required.' }));
      }
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > MAX) return respond(res, 413, JSON.stringify({ error: 'Limite de 500 kB.' }));
        chunks.push(chunk);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return respond(res, 400, JSON.stringify({ error: 'JSON inválido.' })); }
      const preview = convertDrawflowToMarcFlow(input);
      const audit = preview.ok ? verifyPreview(preview) : null;
      return respond(res, 200, JSON.stringify({ preview, audit, safeToPreview: !!audit?.graphContractValid }));
    }
    respond(res, 404, JSON.stringify({ error: 'Rota inexistente.' }));
  } catch {
    respond(res, 500, JSON.stringify({ error: 'Falha na bancada, sem efeitos externos.' }));
  }
});

server.listen(PORT, HOST, () => console.log(`NEXUS_059_LAB=http://${HOST}:${PORT}`));
