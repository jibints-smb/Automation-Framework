// Sprint / platform / module of the things the Studio and Viewer show, so every screen can be filtered the same way.
//   platform: the folder under requirements/, test-cases/ and tests/ (web, mobile, api)
//   module:   the file name: BK-1-login.md, login.testcases.md, login.spec.ts → login
//   sprints:  the story's row in a sprint tracker, or a developer MD received in that sprint
import fs from 'node:fs';
import path from 'node:path';
import { testCasesHeader, walk } from '../scripts/lib.mjs';
import { readRows } from './markdown.mjs';

const rel = (f) => f.replace(/\\/g, '/');

/** Module of a requirement / test-cases / spec file: BK-1-login.md, login.testcases.md, login.spec.ts → login. */
export const moduleOf = (file) =>
  path
    .basename(String(file ?? ''))
    .replace(/\.testcases\.md$|\.spec\.ts$|\.md$/, '')
    .replace(/^[A-Z][A-Z0-9]+-\d+-/, '');

/** Requirement files of an app with their Jira key, platform and module. */
export function requirementFiles(app) {
  const dir = `apps/${app}/requirements`;
  return walk(dir, '.md')
    .filter((f) => !path.basename(f).startsWith('_'))
    .map((f) => {
      const file = rel(f);
      const key = file.replace(`${dir}/`, '');
      const text = fs.readFileSync(f, 'utf8');
      return {
        file,
        key,
        jira: text.match(/^\|\s*Jira\s*\|\s*([A-Z][A-Z0-9]+-\d+)/m)?.[1] ?? path.basename(f).match(/^[A-Z][A-Z0-9]+-\d+/)?.[0] ?? '',
        platform: key.includes('/') ? key.split('/')[0] : '',
        module: moduleOf(file),
      };
    });
}

/** Developer MDs received (sprints/sprint-NN/from-dev/<date>/), each matched to its story's requirement. */
export function devNotes(app, reqs) {
  return walk(`apps/${app}/sprints`, '.md')
    .map(rel)
    .filter((f) => f.includes('/from-dev/'))
    .map((file) => {
      const m = file.match(/sprints\/sprint-(\d+)\/from-dev\/(\d{4}-\d{2}-\d{2})\/(.+)$/);
      const text = fs.readFileSync(file, 'utf8');
      // which story: the key in the file name, the file's own Jira row, or the module name matching a
      // requirement (advertiser-accounts.md → BK-7-advertiser-accounts.md); never a key merely mentioned in the text
      const name = path.basename(file);
      const byModule = reqs.find((r) => path.basename(r.file).toLowerCase().endsWith(`-${name.toLowerCase()}`));
      const jira =
        name.match(/[A-Z][A-Z0-9]+-\d+/)?.[0] ??
        text.match(/^\|\s*Jira(?: key)?\s*\|\s*([A-Z][A-Z0-9]+-\d+)\s*\|/im)?.[1] ??
        byModule?.jira ??
        '';
      const requirement = reqs.find((r) => r.jira && r.jira === jira);
      // merged = the requirement's change log names this delivery (from-dev/<date>)
      const merged = !!requirement && fs.readFileSync(requirement.file, 'utf8').includes(`from-dev/${m?.[2]}`);
      return {
        file,
        sprint: m?.[1] ?? '',
        date: m?.[2] ?? '',
        name: m?.[3] ?? name,
        jira,
        requirement: requirement?.file ?? '',
        merged,
        platform: requirement?.platform ?? '',
        module: requirement?.module ?? moduleOf(name),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** Sprints of each story (Jira key): its row in a sprint tracker's Stories table, or a developer MD in that sprint. */
export function sprintsByJira(app, fromDev) {
  const map = new Map();
  const add = (jira, sprint) => jira && sprint && map.set(jira, [...new Set([...(map.get(jira) ?? []), sprint])].sort());
  const dir = `apps/${app}/sprints`;
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const n = f.match(/^sprint-(\d+)\.md$/)?.[1];
    if (n) for (const row of readRows(fs.readFileSync(path.join(dir, f), 'utf8'), /^Stories/i).rows) add(row.jira?.trim(), n);
  }
  for (const d of fromDev) add(d.jira, d.sprint);
  return map;
}

/**
 * Platform, module and sprints of any file of an app: requirement, test cases, spec, developer MD.
 * `areaOf(path)` → { platform, module, sprints } (empty values when the file says nothing).
 */
export function areas(app) {
  const appDir = `apps/${app}`;
  const reqs = requirementFiles(app);
  const fromDev = devNotes(app, reqs);
  const sprints = sprintsByJira(app, fromDev);
  // spec → test-cases file (its "Spec file" row): the module is the test-cases module, even when the spec is named otherwise
  const specs = new Map();
  for (const f of walk(`${appDir}/test-cases`, '.testcases.md')) {
    const header = testCasesHeader(f);
    if (header.spec) specs.set(`${appDir}/${header.spec}`, { module: moduleOf(f), jira: header.jira ?? '' });
  }
  const byModule = (platform, module) => reqs.find((r) => r.platform === platform && r.module === module);

  function areaOf(file) {
    const p = rel(String(file ?? ''));
    const m = p.match(new RegExp(`^${appDir}/(requirements|test-cases|tests)/([^/]+)/`));
    const dev = p.match(/\/sprints\/sprint-(\d+)\/from-dev\//);
    if (dev) {
      const d = fromDev.find((x) => x.file === p);
      return { platform: d?.platform ?? '', module: d?.module ?? moduleOf(p), sprints: [...new Set([dev[1], ...(sprints.get(d?.jira) ?? [])])] };
    }
    if (!m) return { platform: '', module: '', sprints: [] };
    const platform = m[2];
    const spec = m[1] === 'tests' ? specs.get(p) : undefined;
    const module = spec?.module ?? moduleOf(p);
    const req = m[1] === 'requirements' ? reqs.find((r) => r.file === p) : byModule(platform, module);
    const jira = spec?.jira || req?.jira || '';
    return { platform, module, sprints: sprints.get(jira) ?? [] };
  }
  return { reqs, fromDev, sprints, areaOf };
}

/** The first file of this app named in a command line (a /qa-* target, a spec), for filtering jobs. */
export function fileInCommand(app, command) {
  return String(command ?? '').match(new RegExp(`apps/${app}/[\\w./-]+\\.(?:md|ts)`))?.[0] ?? '';
}
