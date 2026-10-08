/**
 * Company branding of the Allure report: NewAgeSys colours and logo, a header with the project, environment,
 * run date/time and the run's results, and a company footer. Allure 3 only lets us set a report name and a logo,
 * so after `allure generate` this file adds a stylesheet that overrides Allure's colour variables, the header and
 * the footer to every report page (overview, Awesome report, Dashboard, archived single-file reports).
 *
 * Used by allurerc.mjs (report name, logo) and scripts/brand-report.mjs (npm run report, src/report/archive.ts).
 * Change the company look here only.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BRAND = {
  company: 'NewAgeSysIT',
  product: 'QA Automation Report',
  /** Brand colour #4361EE as "r g b". */
  blue: '67 97 238',
};

/** APP / TEST_ENV from the command line or the root .env. */
export function setting(name, fallback) {
  if (process.env[name]) return process.env[name];
  const rootEnv = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  return rootEnv.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1].trim() || fallback;
}

/**
 * Company logo: the image in branding/ (logo.* first if there are several); the default "N" mark when there is none.
 * Logos are embedded as data URIs, so single-file reports stay self-contained.
 */
const BRANDING_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../branding');
const LOGO_TYPES = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const DEFAULT_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#4361EE"/><path d="M11 29V11h3.6l9.2 11.6V11H27v18h-3.5l-9.3-11.7V29z" fill="#fff"/></svg>`;
const DEFAULT_LOGO = `data:image/svg+xml,${encodeURIComponent(DEFAULT_LOGO_SVG)}`;

function findLogo() {
  if (!fs.existsSync(BRANDING_DIR)) return undefined;
  const images = fs.readdirSync(BRANDING_DIR).filter((f) => path.extname(f).slice(1).toLowerCase() in LOGO_TYPES).sort();
  return images.find((f) => /^logo\./i.test(f)) || images[0];
}

/** Width / height of a PNG (other formats: treated as square). */
function aspectRatio(buffer, ext) {
  return ext === 'png' && buffer.length > 24 ? buffer.readUInt32BE(16) / buffer.readUInt32BE(20) : 1;
}

function loadLogo() {
  const name = findLogo();
  if (!name) return { src: DEFAULT_LOGO, custom: false, wide: false };
  const ext = path.extname(name).slice(1).toLowerCase();
  const buffer = fs.readFileSync(path.join(BRANDING_DIR, name));
  return { src: `data:${LOGO_TYPES[ext]};base64,${buffer.toString('base64')}`, custom: true, wide: aspectRatio(buffer, ext) > 1.6 };
}

const logo = loadLogo();
/** The logo for the report header and Allure's logo option. */
export const LOGO = logo.src;
/** Browser-tab icon: a wide logo (company name in it) is unreadable at 16 px, so the default mark is used then. */
const FAVICON = logo.wide ? DEFAULT_LOGO : logo.src;

const CSS = `
html, html[data-theme] {
  color-scheme: light;
  --nas: #4361ee;
  --nas-600: #3651d4;
  --nas-700: #2b41b0;
  --nas-50: #eef1fd;
  --nas-ink: #111a3a;
  --color-bg-canvas: #f4f6fd;
  --color-bg-primary: #ffffff;
  --color-bg-raised: #ffffff;
  --color-bg-secondary: #f7f8fe;
  --color-border-default: #e2e6f6;
  --color-border-subtle: #edf0fa;
  --color-border-medium: #d3d9f2;
  --color-focus-ring: var(--nas);
  --color-link-text: var(--nas-600);
  --color-link-text-hover: var(--nas);
  --color-link-text-active: var(--nas-700);
  --color-intent-primary-bg: var(--nas);
  --color-intent-primary-bg-hover: var(--nas-600);
  --color-intent-primary-bg-active: var(--nas-700);
  --color-intent-primary-on-bg: #ffffff;
  --color-intent-primary-text: var(--nas-600);
  --color-nav-item-bg-active: rgb(${BRAND.blue} / 12%);
  --color-nav-item-bg-active-hover: rgb(${BRAND.blue} / 18%);
  --color-nav-item-bg-hover: rgb(${BRAND.blue} / 8%);
  --color-nav-item-text-active: var(--nas-600);
  --color-nav-item-icon-active: var(--nas-600);
  --color-row-bg-hover: rgb(${BRAND.blue} / 6%);
  --color-row-bg-selected: rgb(${BRAND.blue} / 11%);
  --color-row-bg-selected-hover: rgb(${BRAND.blue} / 16%);
  --color-control-bg-ghost-hover: rgb(${BRAND.blue} / 8%);
  --color-control-bg-ghost-active: rgb(${BRAND.blue} / 14%);
  --allure-tab-underline-color: var(--nas);
}
html, body { background: var(--color-bg-canvas); height: 100%; overflow: hidden !important; }
/* header on top, the Allure app (built for 100vh) in the middle with its own single scrollbar, footer at the bottom */
body { margin: 0; display: flex; flex-direction: column; }
.nas-brand { order: -1; }
.nas-foot { order: 99; }
#app { flex: 1 1 auto; min-height: 0; overflow: auto; }
#app > div { height: 100% !important; min-height: 0 !important; }

/* Allure's own branding: the header already shows the company logo; no "Powered by Allure" link */
[class*="report-logo"] { visibility: hidden; }
a[href*="allurereport.org"] { display: none !important; }

.nas-brand, .nas-foot { font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; box-sizing: border-box; }
.nas-brand *, .nas-foot * { box-sizing: border-box; }
.nas-brand {
  position: relative; z-index: 1000; flex: none;
  display: flex; align-items: center; gap: 24px; flex-wrap: wrap;
  padding: 14px 28px; color: #fff;
  background:
    radial-gradient(1200px 120px at 85% -40px, rgb(255 255 255 / 16%), transparent 70%),
    linear-gradient(115deg, #4361ee 0%, #3a56e4 55%, #2f47c9 100%);
  box-shadow: 0 2px 12px rgb(43 65 176 / 25%);
}
.nas-brand__id { display: flex; align-items: center; gap: 12px; min-width: 0; }
/* square logos fill the tile; wide logos (logo + company name) grow it up to 180px */
.nas-brand__logo {
  min-width: 44px; height: 44px; padding: 5px; border-radius: 12px; background: #fff; flex: none;
  display: grid; place-items: center; box-shadow: 0 2px 6px rgb(0 0 0 / 15%);
}
.nas-brand__logo img { height: 34px; width: auto; max-width: 170px; object-fit: contain; display: block; }
.nas-brand__logo--wide { padding: 4px 12px; }
.nas-brand__logo--wide img { height: 36px; max-width: 190px; }
.nas-brand__divider { width: 1px; height: 32px; background: rgb(255 255 255 / 35%); }
.nas-brand__company { font-size: 19px; font-weight: 700; letter-spacing: .2px; line-height: 1.15; }
.nas-brand__product { font-size: 12.5px; opacity: .85; margin-top: 2px; }
.nas-brand__meta { display: flex; gap: 8px; flex-wrap: wrap; flex: 1 1 auto; justify-content: center; }
.nas-chip {
  display: inline-flex; flex-direction: column; gap: 1px; padding: 6px 12px; border-radius: 10px;
  background: rgb(255 255 255 / 12%); border: 1px solid rgb(255 255 255 / 22%); min-width: 0;
}
.nas-chip small { font-size: 10.5px; text-transform: uppercase; letter-spacing: .6px; opacity: .78; }
.nas-chip span { font-size: 13px; line-height: 1.35; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nas-brand__stats { display: flex; align-items: center; gap: 14px; margin-left: auto; }
.nas-ring {
  --p: 0; width: 52px; height: 52px; border-radius: 50%; flex: none; display: grid; place-items: center;
  background: conic-gradient(#22c55e calc(var(--p) * 1%), #f43f5e 0);
}
.nas-ring.nas-ring--empty { background: rgb(255 255 255 / 25%); }
.nas-ring b {
  width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
  background: #3448c8; font-size: 12px; font-weight: 700;
}
.nas-counts { display: flex; gap: 6px; flex-wrap: wrap; }
.nas-count {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
  background: #fff; color: var(--nas-ink); font-size: 12.5px; font-weight: 600;
}
.nas-count i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.nas-count em { font-style: normal; font-weight: 500; color: #56608a; }
.nas-status {
  padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; letter-spacing: .6px;
  background: #fff; white-space: nowrap;
}
.nas-status--passed { color: #15803d; }
.nas-status--failed { color: #be123c; }
.nas-foot {
  flex: none; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  /* right padding keeps clear of Allure's floating "?" button */
  padding: 8px 64px 8px 28px; font-size: 12px; color: #56608a;
  background: #fff; border-top: 1px solid var(--color-border-default);
}
.nas-foot b { color: var(--nas-600); }
@media (max-width: 900px) {
  .nas-brand { padding: 12px 16px; gap: 12px; }
  .nas-brand__meta { justify-content: flex-start; order: 3; width: 100%; }
  .nas-brand__stats { margin-left: 0; }
  .nas-foot { padding: 8px 16px; }
}
`;

/**
 * Runs first in <head>: Allure follows the OS dark mode unless a theme is saved, and the company look is light,
 * so the saved theme is set to light before Allure starts and kept on the page.
 */
const THEME_SCRIPT = `
(function () {
  try { localStorage.setItem('theme', 'light'); } catch (e) {}
  var root = document.documentElement;
  root.setAttribute('data-theme', 'light');
  new MutationObserver(function () {
    if (root.getAttribute('data-theme') !== 'light') root.setAttribute('data-theme', 'light');
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
`;

/** Shows times in the viewer's local time. */
const LAYOUT_SCRIPT = `
(function () {
  var fmt = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  document.querySelectorAll('[data-nas-time]').forEach(function (el) {
    var t = Number(el.getAttribute('data-nas-time'));
    if (t) el.textContent = new Date(t).toLocaleString(undefined, fmt);
  });
})();
`;

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** 537257 ms → "8m 57s" */
function formatDuration(ms) {
  if (!ms) return '-';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
}

/** Adds the branding to one report page's HTML. Safe to run twice. */
export function brandHtml(html, { project, environment, run = readRun(), testedBy = readTestedBy(), build = '', sprint = '' }) {
  if (html.includes('id="nas-brand"')) return html;
  const title = `${BRAND.company} · ${project} · ${environment} · ${BRAND.product}`;
  const { total, passed, failed, broken, skipped, knownBugs = 0, pendingDecisions = 0, setupFailed, start, stop } = run;
  // pass rate of the tests that ran and are expected to pass (known bugs / PO-pending are reported on their own)
  const counted = total - skipped - knownBugs - pendingDecisions;
  const rate = counted > 0 ? Math.round((passed / counted) * 1000) / 10 : 0;
  const ok = total > 0 && !setupFailed && failed + broken === 0;
  const chip = (label, value, time) =>
    `<div class="nas-chip"><small>${label}</small><span${time ? ` data-nas-time="${time}"` : ''}>${escapeHtml(value)}</span></div>`;
  const count = (label, value, color) =>
    value || label === 'Total' ? `<span class="nas-count">${color ? `<i style="background:${color}"></i>` : ''}<em>${label}</em>${value}</span>` : '';

  const header = `<header id="nas-brand" class="nas-brand">
  <div class="nas-brand__id">
    <div class="nas-brand__logo${logo.wide ? ' nas-brand__logo--wide' : ''}"><img src="${LOGO}" alt="${BRAND.company}"></div>
    ${logo.custom
      // the company logo already shows the name
      ? `<div class="nas-brand__divider"></div><div><div class="nas-brand__company">${BRAND.product}</div><div class="nas-brand__product">Automated test results</div></div>`
      : `<div><div class="nas-brand__company">${BRAND.company}</div><div class="nas-brand__product">${BRAND.product}</div></div>`}
  </div>
  <div class="nas-brand__meta">
    ${chip('Project', project)}${chip('Environment', environment)}${testedBy ? chip('Tested by', testedBy) : ''}${build ? chip('Build', build) : ''}${sprint ? chip('Sprint', sprint) : ''}${chip('Run started', new Date(start).toISOString(), start)}${chip('Duration', formatDuration(stop - start))}
  </div>
  <div class="nas-brand__stats">
    <div class="nas-ring${total ? '' : ' nas-ring--empty'}" style="--p:${rate}" title="Pass rate"><b>${total ? `${Math.round(rate)}%` : '-'}</b></div>
    <div class="nas-counts">
      ${count('Total', total)}${count('Passed', passed, '#22c55e')}${count('Failed', failed, '#f43f5e')}${count('Broken', broken, '#f59e0b')}${count('Known bugs', knownBugs, '#a855f7')}${count('PO pending', pendingDecisions, '#0ea5e9')}${count('Skipped', skipped, '#94a3b8')}
    </div>
    ${setupFailed
      ? '<span class="nas-status nas-status--failed" title="The login setup failed, so the tests did not run">LOGIN SETUP FAILED</span>'
      : total ? `<span class="nas-status nas-status--${ok ? 'passed' : 'failed'}">${ok ? 'PASSED' : 'FAILED'}</span>` : ''}
  </div>
</header>`;
  const footer = `<footer id="nas-foot" class="nas-foot">
  <span>© ${new Date(start).getFullYear()} <b>${BRAND.company}</b> · ${BRAND.product}</span>
  <span>${escapeHtml(project)} · ${escapeHtml(environment)}${testedBy ? ` · tested by <b>${escapeHtml(testedBy)}</b>` : ''} · generated <span data-nas-time="${Date.now()}"></span></span>
</footer>`;

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="icon" href="[^"]*"\s*\/?>/, `<link rel="icon" href="${FAVICON}">`)
    .replace(/<head>/, `<head>\n<script>${THEME_SCRIPT}</script>`)
    .replace('</head>', `<style id="nas-brand-css">${CSS}</style>\n</head>`)
    .replace(/<body([^>]*)>/, `<body$1>\n${header}\n${footer}\n<script>${LAYOUT_SCRIPT}</script>`);
}

/**
 * The run from the Allure results: start/stop and the final status of each test (the last attempt when a test
 * was retried). Counted like the saved-runs list (src/report/archive.ts): the login setup is not a test, and
 * knownBug() / pendingDecision() tests that still fail as expected are counted on their own, not as passed.
 */
export function readRun(resultsDir = 'allure-results') {
  const latest = new Map();
  let start = Infinity, stop = 0;
  let setupFailed = false;
  if (fs.existsSync(resultsDir)) {
    for (const f of fs.readdirSync(resultsDir).filter((n) => n.endsWith('-result.json'))) {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8'));
        if (r.start < start) start = r.start;
        if (r.stop > stop) stop = r.stop;
        if (label(r, 'parentSuite') === 'setup') {
          if (r.status === 'failed' || r.status === 'broken') setupFailed = true;
          continue;
        }
        const key = r.historyId || r.uuid;
        if (!latest.has(key) || (latest.get(key).stop || 0) < (r.stop || 0)) latest.set(key, r);
      } catch { }
    }
  }
  const results = [...latest.values()];
  // Allure marks an expected failure (test.fail) as passed: those are the open known bugs / pending decisions
  const expectedFailure = (name) => results.filter((r) => r.status === 'passed' && label(r, name)).length;
  const knownBugs = expectedFailure('known_bug');
  const pendingDecisions = expectedFailure('pending_decision');
  const n = (s) => results.filter((r) => r.status === s).length;
  const now = Date.now();
  return {
    total: results.length,
    passed: n('passed') - knownBugs - pendingDecisions,
    failed: n('failed'),
    broken: n('broken'),
    skipped: n('skipped'),
    knownBugs,
    pendingDecisions,
    setupFailed,
    start: Number.isFinite(start) ? start : now,
    stop: stop || now,
  };
}

const label = (result, name) => result.labels?.find((l) => l.name === name)?.value;

/**
 * Who ran the tests: "Tested by" that playwright.config.ts wrote to the results (env.qa, from QA_NAME), so the
 * report shows the tester even when someone else builds it. Fallback: QA_NAME, then the git user name.
 */
export function readTestedBy(resultsDir = 'allure-results') {
  const tested = readRunInfo(resultsDir)['Tested by'];
  if (tested) return tested;
  const name = setting('QA_NAME', '');
  if (name) return name;
  try {
    return execSync('git config user.name', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/**
 * The run's environment section (playwright.config.ts environmentInfo, saved as environment.properties):
 * Tested by, Build, Release, Sprint, ...
 */
export function readRunInfo(resultsDir = 'allure-results') {
  const info = {};
  const props = path.join(resultsDir, 'environment.properties');
  if (!fs.existsSync(props)) return info;
  for (const line of fs.readFileSync(props, 'utf8').split(/\r?\n/)) {
    // .properties escapes spaces and special characters with a backslash ("Tested\ by=...")
    const m = line.match(/^((?:\\.|[^=:])+?)\s*[=:]\s*(.*)$/);
    if (m) info[m[1].replace(/\\(.)/g, '$1').trim()] = m[2].replace(/\\(.)/g, '$1').trim();
  }
  return info;
}

/** Brands a report: a folder (every index.html one level deep) or a single report.html. */
export function brandReport(target, meta = {}) {
  const info = {
    project: meta.project || setting('APP', 'app'),
    environment: (meta.environment || setting('TEST_ENV', 'qa')).toUpperCase(),
    run: readRun(meta.resultsDir || 'allure-results'),
    testedBy: meta.testedBy || readTestedBy(meta.resultsDir || 'allure-results'),
    build: readRunInfo(meta.resultsDir || 'allure-results').Build || '',
    sprint: readRunInfo(meta.resultsDir || 'allure-results').Sprint || '',
  };
  const files = fs.statSync(target).isDirectory()
    ? [path.join(target, 'index.html'), ...fs.readdirSync(target).map((d) => path.join(target, d, 'index.html'))]
    : [target];
  let count = 0;
  for (const file of files.filter((f) => fs.existsSync(f))) {
    fs.writeFileSync(file, brandHtml(fs.readFileSync(file, 'utf8'), info));
    count++;
  }
  return count;
}
