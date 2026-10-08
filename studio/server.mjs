// QA Studio: the framework's web UI on this computer.   npm run studio   (opens the browser)
//
// Security: listens on 127.0.0.1 only; the Host header must be this server (blocks DNS rebinding); the browser
// gets a random session token from the link printed at start (kept in an HttpOnly, SameSite=Strict cookie);
// every request needs it and changes also need the X-QA-Studio header. Secrets in .env files are never sent
// to the browser, and command output is redacted (src/report/redact.cjs).
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT); // the scripts and lib.mjs work from the repository root

const { routes } = await import('./api/index.mjs');
const { follow } = await import('./jobs.mjs');

const PUBLIC = path.join(ROOT, 'studio', 'public');

/**
 * Fingerprint of the Studio's server code. Pages are read fresh on every request, but server code only at start:
 * after a git pull or an update the page asks for a restart instead of mixing new pages with an old server.
 */
function codeFingerprint() {
  const files = [path.join(ROOT, 'studio'), path.join(ROOT, 'studio', 'api'), path.join(ROOT, 'scripts')].flatMap((dir) =>
    fs.readdirSync(dir).filter((f) => /\.(mjs|cjs)$/.test(f)).map((f) => path.join(dir, f)),
  );
  const hash = crypto.createHash('sha1');
  for (const file of files.sort()) hash.update(file).update(fs.readFileSync(file));
  return hash.digest('hex').slice(0, 12);
}
const STARTED_CODE = codeFingerprint();
const TOKEN = crypto.randomBytes(24).toString('hex');
const COOKIE = 'qa_studio';
const args = process.argv.slice(2);
const wantedPort = Number(args[args.indexOf('--port') + 1]) || Number(process.env.STUDIO_PORT) || 4400;

buildCss();

const server = http.createServer(async (req, res) => {
  try {
    const port = server.address().port;
    if (!new Set([`127.0.0.1:${port}`, `localhost:${port}`]).has(req.headers.host ?? '')) return send(res, 403, 'Forbidden host');
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    // first open: the link from the terminal carries the token → cookie → clean URL
    if (url.searchParams.get('token') === TOKEN) {
      res.writeHead(302, { 'Set-Cookie': `${COOKIE}=${TOKEN}; HttpOnly; SameSite=Strict; Path=/`, Location: '/' });
      return res.end();
    }
    if (cookie(req, COOKIE) !== TOKEN) {
      return send(res, 401, '<p style="font:16px system-ui;padding:40px">Open QA Studio with the link shown in the terminal where <b>npm run studio</b> runs.</p>', 'text/html');
    }

    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/reports/')) return serveFile(res, path.join(ROOT, 'reports'), url.pathname.slice('/reports/'.length));
    if (url.pathname.startsWith('/live-report/')) return serveFile(res, path.join(ROOT, 'allure-report'), url.pathname.slice('/live-report/'.length) || 'index.html');
    // shipped with the Studio (studio/public/vendor): works even where npm skipped the dev dependencies
    if (url.pathname === '/alpine.js') return serveFile(res, path.join(PUBLIC, 'vendor'), 'alpine.min.js');
    if (url.pathname === '/logo') return serveLogo(res);
    return serveFile(res, PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  } catch (error) {
    send(res, error.status ?? 500, JSON.stringify({ error: error.message }), 'application/json');
  }
});

async function api(req, res, url) {
  // live job output (Server-Sent Events)
  const stream = url.pathname.match(/^\/api\/jobs\/([\w-]+)\/stream$/);
  if (stream && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const stop = follow(stream[1], (event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
    if (!stop) return res.end(`data: ${JSON.stringify({ type: 'end', missing: true })}\n\n`);
    req.on('close', stop);
    return;
  }
  if (url.pathname === '/api/health' && req.method === 'GET') {
    return send(res, 200, JSON.stringify({ restartNeeded: codeFingerprint() !== STARTED_CODE }), 'application/json');
  }
  if (req.method !== 'GET' && req.headers['x-qa-studio'] !== '1') return send(res, 403, JSON.stringify({ error: 'Missing X-QA-Studio header' }), 'application/json');

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = url.pathname.match(route.path);
    if (!match) continue;
    const body = req.method === 'GET' ? {} : await readBody(req);
    const result = await route.handler({ params: match.groups ?? {}, query: Object.fromEntries(url.searchParams), body });
    return send(res, 200, JSON.stringify(result ?? { ok: true }), 'application/json');
  }
  send(res, 404, JSON.stringify({ error: 'Not found' }), 'application/json');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 5 * 1024 * 1024) reject(Object.assign(new Error('Request too large'), { status: 413 }));
      else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webm': 'video/webm',
  '.csv': 'text/csv; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/** A file under `base` only (no ../ escapes), with range support for videos. */
function serveFile(res, base, relative) {
  const file = path.resolve(base, decodeURIComponent(relative));
  if (!file.startsWith(path.resolve(base) + path.sep) && file !== path.resolve(base)) return send(res, 403, 'Forbidden');
  let target = file;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!fs.existsSync(target)) return send(res, 404, 'Not found');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(res);
}

function serveLogo(res) {
  const dir = path.join(ROOT, 'branding');
  const image = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => /\.(svg|png|jpe?g|webp)$/i.test(f)) : undefined;
  if (image) return serveFile(res, dir, image);
  send(res, 200, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#4361EE"/><path d="M11 29V11h3.6l9.2 11.6V11H27v18h-3.5l-9.3-11.7V29z" fill="#fff"/></svg>`, 'image/svg+xml');
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  if (res.headersSent) return res.end();
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN' });
  res.end(body);
}

function cookie(req, name) {
  return (req.headers.cookie ?? '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name)?.[1];
}

/**
 * The pages' CSS. app.css is committed, so every machine has it; when the Tailwind CLI is installed (dev
 * dependencies) it is rebuilt from tailwind.css at start, so style changes need no build step. A failed or
 * impossible rebuild keeps the committed file.
 */
function buildCss() {
  const cli = path.join(ROOT, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');
  const css = path.join(PUBLIC, 'app.css');
  if (!fs.existsSync(cli)) {
    if (!fs.existsSync(css)) console.warn('QA Studio: studio/public/app.css is missing and Tailwind is not installed (npm install --include=dev): pages will look unstyled.');
    return;
  }
  const tmp = path.join(PUBLIC, `app.${process.pid}.css`);
  const run = spawnSync(process.execPath, [cli, '-i', path.join(PUBLIC, 'tailwind.css'), '-o', tmp, '--minify'], { encoding: 'utf8' });
  if (run.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 1000) fs.renameSync(tmp, css);
  else {
    fs.rmSync(tmp, { force: true });
    console.warn(`QA Studio: Tailwind rebuild failed, using the committed app.css.\n${run.stderr ?? ''}`);
  }
}

function openBrowser(url) {
  if (args.includes('--no-open')) return;
  const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).unref();
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && server.listening === false && !server.retried) {
    server.retried = true;
    server.listen(0, '127.0.0.1'); // port taken: any free port
  } else throw error;
});
server.listen(wantedPort, '127.0.0.1', () => {});
server.on('listening', () => {
  const url = `http://127.0.0.1:${server.address().port}/?token=${TOKEN}`;
  console.log(`\nQA Studio is running: ${url}\n(only on this computer; keep this window open, Ctrl+C to stop)\n`);
  openBrowser(url);
});
