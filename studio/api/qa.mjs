// Requirements and test cases: status, files, diffs, uploads, Automate values, traceability, and the Claude
// actions (/qa-testcases, /qa-automate, /qa-update, /qa-fix) run as streamed jobs through scripts/claude-cmd.mjs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  appCode,
  baselineIndex,
  isAutomated,
  latestResults,
  manualResults,
  parseCases,
  requirementHash,
  testCasesHeader,
  testCasesPreconditions,
  testCasesSource,
  walk,
} from '../../scripts/lib.mjs';
import { currentContext, requireApp } from '../context.mjs';
import { startJob } from '../jobs.mjs';
import { devNotes, moduleOf, sprintsByJira } from '../areas.mjs';
import { setCell } from '../markdown.mjs';

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const rel = (f) => f.replace(/\\/g, '/');

/** A file path inside apps/<app>/<folder>/ that exists (no escapes). */
function appFile(app, file, folder, ext = '.md') {
  const p = rel(String(file ?? ''));
  if (!p.startsWith(`apps/${app}/${folder}/`) || p.includes('..') || !p.endsWith(ext) || !fs.existsSync(p)) throw bad(`Not a ${folder} file of ${app}: ${p}`);
  return p;
}

function requirements(app) {
  const appDir = `apps/${app}`;
  const index = baselineIndex(appDir);
  const caseFiles = walk(`${appDir}/test-cases`, '.testcases.md');
  const code = appCode(appDir);
  return walk(`${appDir}/requirements`, '.md')
    .filter((f) => !path.basename(f).startsWith('_'))
    .map((f) => {
      const file = rel(f);
      const key = file.replace(`${appDir}/requirements/`, '');
      const text = fs.readFileSync(f, 'utf8');
      const base = index[key];
      const linked = caseFiles.filter((c) => testCasesSource(c, appDir) === `requirements/${key}`).map(rel);
      const cases = linked.flatMap(parseCases).filter((c) => c.automate === 'yes');
      const changed = !!base && base.hash !== requirementHash(text);
      return {
        file,
        key,
        jira: text.match(/^\|\s*Jira\s*\|\s*([A-Z][A-Z0-9]+-\d+)/m)?.[1] ?? path.basename(f).match(/^[A-Z][A-Z0-9]+-\d+/)?.[0] ?? '',
        title: text.match(/^#\s+(.+)$/m)?.[1] ?? key,
        platform: key.includes('/') ? key.split('/')[0] : '',
        module: moduleOf(file),
        stage: base ? { stage: base.stage, date: base.date, by: base.by } : null,
        changed,
        status: !base ? (linked.length ? 'baseline missing' : 'needs test cases') : changed ? 'changed' : 'up to date',
        testCaseFiles: linked,
        automated: `${cases.filter((c) => isAutomated(c.id, code)).length}/${cases.length}`,
      };
    });
}

export const routes = [
  // ───── requirements ─────
  {
    method: 'GET',
    path: /^\/api\/requirements$/,
    handler: ({ query }) => {
      const app = requireApp(query.app || currentContext().app);
      const reqs = requirements(app);
      const fromDev = devNotes(app, reqs);
      const sprints = sprintsByJira(app, fromDev);
      for (const r of reqs) {
        const notes = fromDev.filter((d) => d.requirement === r.file);
        r.devNotes = notes.length;
        r.unmerged = notes.filter((d) => !d.merged).length;
        r.sprints = sprints.get(r.jira) ?? [];
      }
      return { app, requirements: reqs, fromDev };
    },
  },
  {
    method: 'GET',
    path: /^\/api\/requirements\/file$/,
    handler: ({ query }) => {
      const app = requireApp(query.app || currentContext().app);
      const file = rel(String(query.path ?? ''));
      const allowed = [`apps/${app}/requirements/`, `apps/${app}/test-cases/`, `apps/${app}/sprints/`];
      if (!allowed.some((a) => file.startsWith(a)) || file.includes('..') || !file.endsWith('.md') || !fs.existsSync(file)) throw bad('Not a file of this app', 404);
      const result = { file, content: fs.readFileSync(file, 'utf8') };
      if (file.startsWith(`apps/${app}/requirements/`)) {
        const diff = spawnSync(process.execPath, ['scripts/req-track.mjs', 'diff', file], { encoding: 'utf8', env: { ...process.env, APP: app } });
        result.diff = (diff.stdout || diff.stderr).trim();
      }
      return result;
    },
  },
  {
    method: 'POST',
    path: /^\/api\/requirements$/,
    handler: ({ body }) => {
      const app = requireApp(body.app || currentContext().app);
      if (!['web', 'mobile', 'api'].includes(body.platform)) throw bad('Platform: web, mobile or api');
      const platform = body.platform;
      if (!/^[A-Z][A-Z0-9]+-\d+$/.test(body.jira ?? '')) throw bad('Jira key like BK-12');
      if (!/^[a-z][a-z0-9-]{1,40}$/.test(body.module ?? '')) throw bad('Module name: lower case with dashes, e.g. forgot-password');
      const file = `apps/${app}/requirements/${platform}/${body.jira}-${body.module}.md`;
      if (fs.existsSync(file)) throw bad(`${file} already exists`);
      let content = body.content?.trim();
      if (!content) {
        content = fs
          .readFileSync('templates/requirement.md', 'utf8')
          .replaceAll('<JIRA-KEY>', body.jira)
          .replaceAll('<module>', body.module)
          .replace('<Module / story title>', body.title || body.module);
      }
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
      return { ok: true, file };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/requirements\/upload$/,
    handler: ({ body }) => {
      const app = requireApp(body.app || currentContext().app);
      if (!/^\d{1,3}$/.test(String(body.sprint ?? ''))) throw bad('Sprint number like 01');
      const name = String(body.filename ?? '').replace(/[^\w.\-]/g, '_');
      if (!/\.md$/i.test(name)) throw bad('Upload a .md file');
      const date = new Date().toISOString().slice(0, 10);
      const dir = `apps/${app}/sprints/sprint-${String(body.sprint).padStart(2, '0')}/from-dev/${date}`;
      fs.mkdirSync(dir, { recursive: true });
      const file = `${dir}/${name}`;
      if (fs.existsSync(file)) throw bad(`${file} already exists`);
      // saved unchanged (as the developers sent it): QA merges it into the requirement afterwards
      fs.writeFileSync(file, String(body.content ?? ''));
      return { ok: true, file };
    },
  },

  // ───── test cases ─────
  {
    method: 'GET',
    path: /^\/api\/testcases$/,
    handler: ({ query }) => {
      const app = requireApp(query.app || currentContext().app);
      const appDir = `apps/${app}`;
      const code = appCode(appDir);
      const automated = latestResults(app);
      const manual = manualResults(appDir);
      const sprints = sprintsByJira(app, devNotes(app, requirements(app)));
      const files = walk(`${appDir}/test-cases`, '.testcases.md').map((f) => {
        const cases = parseCases(f).map((c) => {
          const auto = automated.get(c.id);
          const man = manual.get(c.id);
          return {
            id: c.id,
            title: c.title,
            type: c.type,
            priority: c.priority,
            automate: c.automate,
            tags: c.tags,
            steps: c.steps,
            expected: c.expected,
            hasTest: isAutomated(c.id, code),
            result: auto?.result ?? '',
            resultDate: auto?.started ?? '',
            note: auto?.note ?? '',
            resultBuild: auto?.build ?? '',
            resultEnv: auto?.environment ?? '',
            manual: man ? `${man.result} (${man.date})` : '',
            // the test-case drawer: who tested it by hand, on which build, and the bug raised
            manualDetail: man ? { result: man.result, date: man.date, by: man.by, build: man.build, bug: man.bug, notes: man.notes } : null,
          };
        });
        const header = testCasesHeader(f);
        const folder = rel(f).replace(`${appDir}/test-cases/`, '');
        return {
          file: rel(f),
          header,
          preconditions: testCasesPreconditions(f),
          // the folder (web / mobile / api, like requirements/); the header's Platform is free text ("android, ios")
          platform: folder.includes('/') ? folder.split('/')[0] : header.platform || '',
          module: moduleOf(f),
          sprints: sprints.get(header.jira) ?? [],
          cases,
        };
      });
      const all = files.flatMap((f) => f.cases).filter((c) => c.automate !== 'retired');
      const yes = all.filter((c) => c.automate === 'yes');
      return {
        app,
        files,
        coverage: {
          total: all.length,
          automated: all.filter((c) => c.hasTest).length,
          missing: yes.filter((c) => !c.hasTest).length,
          later: all.filter((c) => c.automate === 'later').length,
          manualOnly: all.filter((c) => c.automate === 'no').length,
          covered: all.filter((c) => c.hasTest || c.manual).length,
        },
      };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/testcases\/automate$/,
    handler: ({ body }) => {
      const app = requireApp(body.app || currentContext().app);
      const file = appFile(app, body.file, 'test-cases');
      if (!['yes', 'later', 'no', 'retired'].includes(body.value)) throw bad('Automate: yes, later, no or retired');
      if (!/^TC-[A-Z0-9-]+$/i.test(body.id ?? '')) throw bad('Test case ID');
      const text = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, setCell(text, { keyColumn: 'ID', key: body.id, column: 'Automate', value: body.value }));
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/trace$/,
    handler: ({ body }) => {
      const app = requireApp(body.app || currentContext().app);
      return startJob({ kind: 'check', title: 'Traceability check', args: ['scripts/trace-check.mjs', app], env: { APP: app }, by: currentContext().qaName });
    },
  },

  // ───── Claude actions ─────
  {
    method: 'POST',
    path: /^\/api\/claude\/(?<command>qa-testcases|qa-automate|qa-update|qa-fix|qa-merge)$/,
    handler: ({ params, body }) => {
      const app = requireApp(body.app || currentContext().app);
      const command = params.command;
      let target = '';
      if (command === 'qa-testcases' || command === 'qa-update') target = appFile(app, body.target, 'requirements');
      if (command === 'qa-automate') target = appFile(app, body.target, 'test-cases');
      if (command === 'qa-merge') {
        target = appFile(app, body.target, 'sprints');
        if (!target.includes('/from-dev/')) throw bad('Choose a developer file (sprints/.../from-dev/)');
      }
      if (command === 'qa-fix' && body.target) {
        target = String(body.target);
        if (!/^@[\w-]+$/.test(target)) target = appFile(app, target, 'tests', '.ts');
      }
      const titles = { 'qa-testcases': 'Generate test cases', 'qa-automate': 'Automate test cases', 'qa-update': 'Update tests for a changed requirement', 'qa-fix': 'Investigate failing tests', 'qa-merge': 'Merge developer notes into the requirement' };
      return startJob({
        kind: 'claude',
        title: `${titles[command]}${target ? `: ${path.basename(target)}` : ''}`,
        args: ['scripts/claude-cmd.mjs', command, ...(target ? [target] : [])],
        env: { APP: app },
        by: currentContext().qaName,
      });
    },
  },
];
