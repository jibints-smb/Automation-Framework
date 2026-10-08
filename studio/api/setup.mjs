// Setup: the QA's own settings (root .env) and the Home page summary.
import fs from 'node:fs';
import path from 'node:path';
import {
  baselineIndex,
  latestResults,
  manualResults,
  mdTables,
  parseCases,
  requirementHash,
  savedRuns,
  testCasesSource,
  walk,
} from '../../scripts/lib.mjs';
import { readEnv, updateEnv } from '../envfile.mjs';
import { ROOT_ENV, currentContext, listApps } from '../context.mjs';

/** The root settings the Setup page edits, with labels and validation. */
export const SETTINGS = [
  { key: 'QA_NAME', label: 'Your name', help: 'Shown as "Tested by" in every report and on sign-offs.', required: true, pattern: '^.{2,60}$' },
  { key: 'QA_EMAIL', label: 'Your email', help: 'Shown next to your name in the report details.', type: 'email' },
  { key: 'APP', label: 'Active app', help: 'The app tests, reports and commands work on.', type: 'app', required: true },
  { key: 'TEST_ENV', label: 'Environment', help: 'qa uses the app\'s .env; other names need apps/<app>/.env.<name>.', pattern: '^[a-z0-9-]{1,20}$' },
  { key: 'BUILD_VERSION', label: 'Build under test', help: 'The version the developers delivered, e.g. v0.2.0. Recorded with every run.', pattern: '^[\\w.\\- +]{0,40}$' },
  { key: 'SPRINT', label: 'Sprint', help: 'Sprint number, e.g. 01. Used by the sprint report.', pattern: '^\\d{0,3}$' },
  { key: 'RELEASE', label: 'Release', help: 'Optional release name.', pattern: '^[\\w.\\- ]{0,40}$' },
  { key: 'JIRA_BASE_URL', label: 'Jira URL', help: 'e.g. https://yourcompany.atlassian.net: makes Jira keys clickable in reports.', type: 'url' },
  { key: 'NOTIFY_WEBHOOK', label: 'Teams / Slack webhook', help: 'Optional: a short summary of every run is posted here.', type: 'url', secret: true },
  { key: 'REPORT_ARCHIVE', label: 'Save every run', type: 'select', options: ['on', 'off'] },
  { key: 'REPORT_KEEP_DAYS', label: 'Keep saved runs (days)', help: '0 = forever', type: 'number', placeholder: '30 (default)' },
  { key: 'REPORT_KEEP_RUNS', label: 'Keep at most (runs per app)', help: '0 = no limit', type: 'number', placeholder: '50 (default)' },
  {
    key: 'NODE_EXTRA_CA_CERTS',
    label: 'Company root certificate (only behind a company proxy)',
    help: 'Path to the .pem file from IT, when Claude or tests fail with "self-signed certificate". Restart QA Studio after changing it.',
    type: 'file',
  },
  { key: 'REPORT_EVIDENCE', label: 'Evidence of failures', help: 'trace also records typed passwords: keep it inside the QA team.', type: 'select', options: ['video', 'trace', 'none'] },
];

function ensureRootEnv() {
  if (!fs.existsSync(ROOT_ENV) && fs.existsSync('.env.example')) fs.copyFileSync('.env.example', ROOT_ENV);
}

function validate(def, value) {
  if (value === '' || value === null) {
    if (def.required) throw Object.assign(new Error(`${def.label} is required`), { status: 400 });
    return;
  }
  const v = String(value);
  if (def.type === 'app' && !listApps().includes(v)) throw Object.assign(new Error(`Unknown app "${v}"`), { status: 400 });
  if (def.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw Object.assign(new Error(`${def.label}: not an email address`), { status: 400 });
  if (def.type === 'url' && !/^https?:\/\/\S+$/.test(v)) throw Object.assign(new Error(`${def.label}: must start with http:// or https://`), { status: 400 });
  if (def.type === 'file' && !fs.existsSync(v)) throw Object.assign(new Error(`${def.label}: file not found: ${v}`), { status: 400 });
  if (def.type === 'number' && !/^\d{1,4}$/.test(v)) throw Object.assign(new Error(`${def.label}: a whole number`), { status: 400 });
  if (def.type === 'select' && !def.options.includes(v)) throw Object.assign(new Error(`${def.label}: one of ${def.options.join(', ')}`), { status: 400 });
  if (def.pattern && !new RegExp(def.pattern).test(v)) throw Object.assign(new Error(`${def.label}: invalid value`), { status: 400 });
}

/** Open work for the Home page: requirements to process, critical cases not tested, PO decisions pending. */
function openItems(app) {
  if (!app) return {};
  const appDir = `apps/${app}`;
  const index = baselineIndex(appDir);
  const caseFiles = walk(`${appDir}/test-cases`, '.testcases.md');
  const requirements = walk(`${appDir}/requirements`, '.md').filter((f) => !path.basename(f).startsWith('_'));
  const changed = [];
  const fresh = [];
  for (const file of requirements) {
    const key = path.relative(`${appDir}/requirements`, file).replace(/\\/g, '/');
    const base = index[key];
    const linked = caseFiles.some((f) => testCasesSource(f, appDir) === `requirements/${key}`);
    if (base && base.hash !== requirementHash(fs.readFileSync(file, 'utf8'))) changed.push(key);
    else if (!base && !linked) fresh.push(key);
  }
  const automated = latestResults(app);
  const manual = manualResults(appDir);
  const cases = caseFiles.flatMap(parseCases).filter((c) => c.automate !== 'retired');
  const criticalNotTested = cases
    .filter((c) => ['critical', 'blocker'].includes(c.priority) && !automated.has(c.id) && !manual.has(c.id))
    .map((c) => ({ id: c.id, title: c.title }));
  // open PO differences in the newest sprint file
  const sprintFiles = fs.existsSync(`${appDir}/sprints`) ? fs.readdirSync(`${appDir}/sprints`).filter((f) => /^sprint-\d+\.md$/.test(f)).sort() : [];
  const latestSprint = sprintFiles.at(-1);
  let differences = 0;
  if (latestSprint) {
    const table = mdTables(fs.readFileSync(`${appDir}/sprints/${latestSprint}`, 'utf8')).find((t) => /^Differences/i.test(t.heading));
    differences = (table?.rows ?? []).filter((r) => (r['#'] || r.jira) && /\S/.test(r['difference (story → build)'] ?? r.difference ?? '') && !/closed|not a bug|accept/i.test(`${r.decision ?? ''} ${r['proposed outcome'] ?? ''}`) && !/^[A-Z][A-Z0-9]+-\d+$/.test((r.decision ?? '').trim())).length;
  }
  return { changed, fresh, criticalNotTested, differences, latestSprint: latestSprint?.match(/\d+/)?.[0], testCases: cases.length };
}

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/context$/,
    handler: () => {
      const context = currentContext();
      const runs = context.app ? savedRuns(context.app) : [];
      const strip = (r) => r && (({ tests, ...rest }) => ({ ...rest, run: path.basename(r.dir) }))(r);
      return { ...context, latestRun: strip(runs[0]), recentRuns: runs.slice(0, 8).map(strip), open: openItems(context.app) };
    },
  },
  {
    method: 'GET',
    path: /^\/api\/settings$/,
    handler: () => {
      ensureRootEnv();
      const values = new Map(readEnv(ROOT_ENV).map((e) => [e.key, e]));
      return {
        apps: listApps(),
        settings: SETTINGS.map((def) => {
          const e = values.get(def.key);
          return { ...def, value: def.secret ? undefined : (e?.value ?? ''), set: !!e?.set };
        }),
      };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/settings$/,
    handler: ({ body }) => {
      ensureRootEnv();
      const changes = {};
      for (const [key, value] of Object.entries(body.changes ?? {})) {
        const def = SETTINGS.find((d) => d.key === key);
        if (!def) throw Object.assign(new Error(`Unknown setting ${key}`), { status: 400 });
        validate(def, value);
        changes[key] = value === null ? '' : String(value).trim();
      }
      updateEnv(ROOT_ENV, changes);
      return { ok: true, saved: Object.keys(changes) };
    },
  },
];
