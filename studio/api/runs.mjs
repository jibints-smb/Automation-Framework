// Run tests: the options the Run page offers, and starting a run as a job (one test run at a time).
import fs from 'node:fs';
import path from 'node:path';
import { parseCases, testCasesHeader, walk } from '../../scripts/lib.mjs';
import { appInfo, appProjects, currentContext, requireApp } from '../context.mjs';
import { startJob } from '../jobs.mjs';

const PLAYWRIGHT = 'node_modules/@playwright/test/cli.js';
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const TAGS = ['@smoke', '@regression', '@a11y', '@visual', '@perf', '@api'];

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/run-options$/,
    handler: ({ query }) => {
      const app = requireApp(query.app || currentContext().app);
      const appDir = `apps/${app}`;
      const info = appInfo(app);
      const caseFiles = walk(`${appDir}/test-cases`, '.testcases.md');
      const stories = [...new Map(caseFiles.map((f) => testCasesHeader(f)).filter((h) => h.jira).map((h) => [h.jira, { jira: h.jira, feature: h.feature ?? '' }])).values()];
      const sprints = fs.existsSync(`${appDir}/sprints`) ? fs.readdirSync(`${appDir}/sprints`).map((f) => f.match(/^sprint-(\d+)\.md$/)?.[1]).filter(Boolean) : [];
      return {
        app,
        projects: appProjects(info),
        environments: ['qa', ...info.envFiles.map((f) => f.replace(/^\.env\.?/, '')).filter((e) => e && e !== 'example')],
        stories,
        sprints,
        specs: walk(`${appDir}/tests`, '.spec.ts').map((f) => f.replace(/\\/g, '/')),
        testCases: caseFiles.flatMap(parseCases).filter((c) => c.automate === 'yes').map((c) => ({ id: c.id, title: c.title })),
        tags: TAGS,
      };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/runs$/,
    handler: ({ body }) => {
      const ctx = currentContext();
      const app = requireApp(body.app || ctx.app);
      const info = appInfo(app);
      const pw = [];

      // which tests
      const scope = body.scope ?? 'all';
      let title = 'All tests';
      let script; // story / sprint go through scripts/run-scope.mjs (spec files from the test-cases files)
      if (scope === 'smoke' || scope === 'regression') {
        pw.push('--grep', `@${scope}`);
        title = scope === 'smoke' ? 'Smoke tests' : 'Regression';
      } else if (scope === 'tag') {
        if (!TAGS.includes(body.value) && !/^@[\w-]{1,40}$/.test(body.value ?? '')) throw bad('Tag like @smoke');
        pw.push('--grep', body.value);
        title = `Tests tagged ${body.value}`;
      } else if (scope === 'ids') {
        const ids = String(body.value ?? '').split(/[\s,]+/).filter(Boolean);
        if (!ids.length || ids.some((id) => !/^TC-[A-Z0-9-]{1,40}$/i.test(id))) throw bad('Test case IDs like TC-LOGIN-01, separated by commas');
        pw.push('--grep', `(${ids.join('|')}) \\|`);
        title = `Test cases ${ids.join(', ')}`;
      } else if (scope === 'spec') {
        const spec = String(body.value ?? '').replace(/\\/g, '/');
        if (!spec.startsWith(`apps/${app}/tests/`) || !spec.endsWith('.spec.ts') || spec.includes('..') || !fs.existsSync(spec)) throw bad('Choose a spec file of this app');
        pw.push(spec);
        title = `Spec ${path.basename(spec)}`;
      } else if (scope === 'story') {
        if (!/^[A-Z][A-Z0-9]+-\d+$/.test(body.value ?? '')) throw bad('Story Jira key like BK-1');
        script = ['scripts/run-scope.mjs', 'story', body.value];
        title = `Story ${body.value}`;
      } else if (scope === 'sprint') {
        if (!/^\d{1,3}$/.test(body.value ?? '')) throw bad('Sprint number like 01');
        script = ['scripts/run-scope.mjs', 'sprint', body.value];
        title = `Sprint ${body.value}`;
      } else if (scope !== 'all') {
        throw bad(`Unknown scope ${scope}`);
      }

      // how
      const allowed = appProjects(info);
      for (const project of body.projects ?? []) {
        if (!allowed.includes(project)) throw bad(`Unknown project ${project}`);
        pw.push(`--project=${project}`);
      }
      if (body.headed) pw.push('--headed');
      if (body.workers !== undefined && body.workers !== '') {
        if (!/^([1-9]|1[0-6])$/.test(String(body.workers))) throw bad('Workers: 1 to 16');
        pw.push(`--workers=${body.workers}`);
      }
      if (body.retries !== undefined && body.retries !== '') {
        if (!/^[0-3]$/.test(String(body.retries))) throw bad('Retries: 0 to 3');
        pw.push(`--retries=${body.retries}`);
      }

      // for this run only (the saved settings stay as they are)
      const env = { APP: app };
      if (body.environment) {
        if (!/^[a-z0-9-]{1,20}$/.test(body.environment)) throw bad('Environment name');
        env.TEST_ENV = body.environment;
      }
      if (body.build) {
        if (!/^[\w.\- +]{1,40}$/.test(body.build)) throw bad('Build version');
        env.BUILD_VERSION = body.build;
      }
      if (body.sprint) {
        if (!/^\d{1,3}$/.test(body.sprint)) throw bad('Sprint number');
        env.SPRINT = body.sprint;
      }

      const args = script ? [...script, '--', ...pw] : [PLAYWRIGHT, 'test', ...pw];
      return startJob({ kind: 'test', title, args, env, by: ctx.qaName, meta: { app, scope, value: body.value ?? '' } });
    },
  },
];
