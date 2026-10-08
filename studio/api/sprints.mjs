// Sprints: the tracker (sprints/sprint-NN.md) as forms, manual results, the sign-off report and story sign-off.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { baselineIndex, parseCases, walk } from '../../scripts/lib.mjs';
import { currentContext, requireApp } from '../context.mjs';
import { startJob } from '../jobs.mjs';
import { addRow, readRows, setCell } from '../markdown.mjs';

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
/** The tracker's tables (headings as in templates/sprint.md) and the column that identifies a row. */
const TABLES = {
  stories: { heading: /^Stories/i, key: 'jira' },
  builds: { heading: /^Builds/i, key: 'date' },
  questions: { heading: /^Questions/i, key: 'question' },
  differences: { heading: /^Differences/i, key: '#' },
  bugs: { heading: /^Bugs/i, key: 'jira bug' },
};

function sprintFiles(app, nn) {
  if (!/^\d{1,3}$/.test(String(nn))) throw bad('Sprint number like 01');
  const n = String(nn).padStart(2, '0');
  const tracker = `apps/${requireApp(app)}/sprints/sprint-${n}.md`;
  return { n, tracker, manual: `apps/${app}/sprints/sprint-${n}/manual-results.md` };
}

function ensureManualFile(app, n, file) {
  if (fs.existsSync(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, fs.readFileSync('templates/manual-results.md', 'utf8').replaceAll('<NN>', n).replaceAll('<app>', app));
}

const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, 500);

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/sprints$/,
    handler: ({ query }) => {
      const app = requireApp(query.app || currentContext().app);
      const dir = `apps/${app}/sprints`;
      const sprints = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
        .map((f) => f.match(/^sprint-(\d+)\.md$/)?.[1])
        .filter(Boolean)
        .sort()
        .map((n) => {
          const text = fs.readFileSync(`${dir}/sprint-${n}.md`, 'utf8');
          const info = Object.fromEntries(readRows(text, /^Sprint/i).rows.map((r) => [r.item?.toLowerCase(), r.value]));
          return { number: n, dates: info.dates ?? '', goal: info.goal ?? '', stories: readRows(text, TABLES.stories.heading).rows.filter((r) => r.jira).length };
        });
      return { app, sprints };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/sprints$/,
    handler: ({ body }) => {
      const app = requireApp(body.app || currentContext().app);
      const { n, tracker } = sprintFiles(app, body.number);
      if (fs.existsSync(tracker)) throw bad(`Sprint ${n} already exists`);
      const run = spawnSync(process.execPath, ['scripts/sprint.mjs', 'new', n, app], { encoding: 'utf8', env: { ...process.env, APP: app } });
      if (run.status !== 0) throw bad((run.stderr || run.stdout).trim());
      return { ok: true, number: n };
    },
  },
  {
    method: 'GET',
    path: /^\/api\/sprints\/(?<app>[\w-]+)\/(?<nn>\d+)$/,
    handler: ({ params }) => {
      const { n, tracker, manual } = sprintFiles(params.app, params.nn);
      if (!fs.existsSync(tracker)) throw bad(`No sprint ${n}`, 404);
      const text = fs.readFileSync(tracker, 'utf8');
      const tables = Object.fromEntries(Object.entries(TABLES).map(([name, t]) => [name, readRows(text, t.heading)]));
      const info = Object.fromEntries(text.match(/^\|\s*Item\s*\|/m) ? readRowsFirst(text).map((r) => [r.item, r.value]) : []);
      // sign-off state of each story's requirement
      const index = baselineIndex(`apps/${params.app}`);
      for (const story of tables.stories.rows) {
        const key = (story['requirement file'] ?? '').replace(/^requirements\//, '');
        story.baseline = index[key] ? `${index[key].stage} ${index[key].date}${index[key].by ? ` (${index[key].by})` : ''}` : '';
        story.signedOff = index[key]?.stage === 'signed-off';
      }
      const caseFiles = walk(`apps/${params.app}/test-cases`, '.testcases.md');
      const testCases = caseFiles.flatMap(parseCases).filter((c) => c.automate !== 'retired').map((c) => ({ id: c.id, title: c.title, automate: c.automate, priority: c.priority }));
      const report = `reports/${params.app}/sprint-${n}-report.html`;
      return {
        app: params.app,
        number: n,
        info,
        tables,
        manual: fs.existsSync(manual) ? readRows(fs.readFileSync(manual, 'utf8'), /^Manual test results/i) : { columns: [], rows: [] },
        testCases,
        reportUrl: fs.existsSync(report) ? `/${report}` : '',
      };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/sprints\/(?<app>[\w-]+)\/(?<nn>\d+)\/rows$/,
    handler: ({ params, body }) => {
      const { tracker } = sprintFiles(params.app, params.nn);
      const table = TABLES[body.table];
      if (!table) throw bad('Unknown table');
      const values = Object.fromEntries(Object.entries(body.values ?? {}).map(([k, v]) => [k.toLowerCase(), clean(v)]));
      if (!values[table.key]) throw bad(`"${table.key}" is required`);
      fs.writeFileSync(tracker, addRow(fs.readFileSync(tracker, 'utf8'), { heading: table.heading, values }));
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/sprints\/(?<app>[\w-]+)\/(?<nn>\d+)\/cell$/,
    handler: ({ params, body }) => {
      const { tracker } = sprintFiles(params.app, params.nn);
      const table = TABLES[body.table];
      if (!table) throw bad('Unknown table');
      const text = fs.readFileSync(tracker, 'utf8');
      fs.writeFileSync(tracker, setCell(text, { heading: table.heading, keyColumn: table.key, key: clean(body.key), column: clean(body.column), value: clean(body.value) }));
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/sprints\/(?<app>[\w-]+)\/(?<nn>\d+)\/manual$/,
    handler: ({ params, body }) => {
      const { n, manual } = sprintFiles(params.app, params.nn);
      if (!/^TC-[A-Z0-9-]+$/i.test(body.id ?? '')) throw bad('Choose a test case');
      if (!['pass', 'fail', 'blocked'].includes(body.result)) throw bad('Result: pass, fail or blocked');
      if (body.result === 'fail' && !/^[A-Z][A-Z0-9]+-\d+$/.test(body.bug ?? '')) throw bad('A failed manual test needs its Jira bug key');
      ensureManualFile(params.app, n, manual);
      const values = {
        id: body.id,
        build: clean(body.build || currentContext().build),
        result: body.result,
        'tested by': currentContext().qaName || 'QA',
        date: new Date().toISOString().slice(0, 10),
        bug: clean(body.bug),
        notes: clean(body.notes),
      };
      fs.writeFileSync(manual, addRow(fs.readFileSync(manual, 'utf8'), { heading: /^Manual test results/i, values }));
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/sprints\/(?<app>[\w-]+)\/(?<nn>\d+)\/report$/,
    handler: ({ params }) => {
      const { n } = sprintFiles(params.app, params.nn);
      const run = spawnSync(process.execPath, ['scripts/sprint.mjs', 'report', n, params.app], { encoding: 'utf8', env: { ...process.env, APP: params.app } });
      if (run.status !== 0) throw bad((run.stderr || run.stdout).trim());
      return { ok: true, output: run.stdout.trim(), url: `/reports/${params.app}/sprint-${n}-report.html` };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/sprints\/(?<app>[\w-]+)\/signoff$/,
    handler: ({ params, body }) => {
      const app = requireApp(params.app);
      const file = String(body.requirement ?? '').replace(/\\/g, '/');
      const full = `apps/${app}/${file}`;
      if (!file.startsWith('requirements/') || file.includes('..') || !file.endsWith('.md') || !fs.existsSync(full)) throw bad('Unknown requirement file');
      const by = currentContext().qaName;
      if (!by) throw bad('Set your name in Setup first: sign-off records who signed.');
      // the same guards as on the command line: tests green, nothing waiting for the PO, requirement unchanged
      return startJob({ kind: 'signoff', title: `Sign off ${path.basename(file)}`, args: ['scripts/req-track.mjs', 'baseline', full, '--stage', 'signed-off', '--by', by], env: { APP: app }, by });
    },
  },
];

/** The Item | Value table at the top of the tracker. */
function readRowsFirst(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^\|\s*Item\s*\|/.test(l));
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    const [item, value] = lines[i].replace(/^\s*\||\|\s*$/g, '').split('|').map((c) => c.trim());
    rows.push({ item: item.toLowerCase(), value });
  }
  return rows;
}
