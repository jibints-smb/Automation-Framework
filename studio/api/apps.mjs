// Apps: list, create (the New app form runs scripts/new-app.mjs), and each app's settings (.env files).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseCases, savedRuns, walk } from '../../scripts/lib.mjs';
import { readEnv, updateEnv } from '../envfile.mjs';
import { ROOT_ENV, appInfo, appProjects, listApps, requireApp } from '../context.mjs';

const ENV_FILE = /^\.env(\.[a-z0-9-]{1,20})?$/;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

function envPath(app, file) {
  if (!ENV_FILE.test(file)) throw bad(`Not an app settings file: ${file}`);
  return path.join('apps', requireApp(app), file);
}

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/apps$/,
    handler: () =>
      listApps().map((app) => {
        const info = appInfo(app);
        const cases = walk(`apps/${app}/test-cases`, '.testcases.md').flatMap(parseCases).filter((c) => c.automate !== 'retired');
        const latest = savedRuns(app)[0];
        return {
          ...info,
          projects: appProjects(info),
          testCases: cases.length,
          latestRun: latest && { started: latest.started, status: latest.status, passed: latest.passed, failed: latest.failed, total: latest.total },
        };
      }),
  },
  {
    method: 'GET',
    path: /^\/api\/apps\/(?<app>[\w-]+)$/,
    handler: ({ params }) => {
      const info = appInfo(requireApp(params.app));
      return { ...info, projects: appProjects(info) };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/apps$/,
    handler: ({ body }) => {
      const { name, platforms = [], baseUrl, testId, browsers = [], locale, timezone, roles = [], makeActive } = body;
      if (!/^[a-z][a-z0-9-]{1,40}$/.test(name ?? '')) throw bad('App name: lower case letters, digits and dashes, e.g. "customer-portal"');
      if (listApps().includes(name)) throw bad(`An app "${name}" already exists`);
      const args = ['scripts/new-app.mjs', name, '--platforms', platforms.join(',') || 'web'];
      if (baseUrl) args.push('--base-url', baseUrl);
      if (testId) args.push('--test-id', testId);
      if (browsers.length) args.push('--browsers', browsers.join(','));
      if (locale) args.push('--locale', locale);
      if (timezone) args.push('--timezone', timezone);
      if (roles.length) args.push('--roles', roles.map((r) => `${r.role}:${r.usernameEnv}:${r.passwordEnv}`).join(','));
      const run = spawnSync(process.execPath, args, { encoding: 'utf8' });
      if (run.status !== 0) throw bad((run.stderr || run.stdout).trim());
      if (makeActive) updateEnv(ROOT_ENV, { APP: name });
      return { ok: true, app: name, output: run.stdout };
    },
  },
  {
    method: 'GET',
    path: /^\/api\/apps\/(?<app>[\w-]+)\/env\/(?<file>[\w.-]+)$/,
    handler: ({ params }) => {
      const file = envPath(params.app, params.file);
      // settings that exist only in .env.example are offered too, so nothing has to be typed from memory
      const example = readEnv(path.join('apps', params.app, '.env.example'));
      const current = readEnv(file);
      const keys = new Map(current.map((e) => [e.key, e]));
      for (const e of example) if (!keys.has(e.key)) keys.set(e.key, { ...e, value: e.secret ? undefined : '', set: false, commented: true });
      return { file: params.file, exists: fs.existsSync(file), settings: [...keys.values()] };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/apps\/(?<app>[\w-]+)\/env\/(?<file>[\w.-]+)$/,
    handler: ({ params, body }) => {
      const file = envPath(params.app, params.file);
      const changes = {};
      for (const [key, value] of Object.entries(body.changes ?? {})) {
        if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw bad(`Setting names are UPPER_CASE: ${key}`);
        if (value !== null && /[\r\n]/.test(String(value))) throw bad(`${key}: no line breaks`);
        changes[key] = value === null ? '' : String(value);
      }
      updateEnv(file, changes);
      return { ok: true, saved: Object.keys(changes) };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/apps\/(?<app>[\w-]+)\/environments$/,
    handler: ({ params, body }) => {
      const name = String(body.name ?? '');
      if (!/^[a-z0-9-]{1,20}$/.test(name) || name === 'qa') throw bad('Environment name: lower case, e.g. staging or uat (qa uses .env)');
      const file = envPath(params.app, `.env.${name}`);
      if (fs.existsSync(file)) throw bad(`.env.${name} already exists`);
      // the app's .env layout with every setting commented out: only what is filled in here overrides .env
      // (an empty KEY= would override .env with nothing)
      const source = fs.existsSync(path.join('apps', params.app, '.env.example')) ? '.env.example' : '.env';
      const text = fs.readFileSync(path.join('apps', params.app, source), 'utf8').replace(/^\s*([A-Z][A-Z0-9_]*)\s*=.*$/gm, '# $1=');
      fs.writeFileSync(file, `# Settings for TEST_ENV=${name}: only the values set here replace the ones in .env\n${text}`);
      return { ok: true, file: `.env.${name}` };
    },
  },
];
