// Activity: one timeline of what happened in an app. Test runs (terminal and Studio), Studio jobs, requirement
// stages (cases / automated / signed-off), developer MDs received and git commits. Read-only.
// Each item carries the sprints, platforms and modules it is about (areas.mjs), for the filter; commits have none.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { baselineIndex, savedRuns } from '../../scripts/lib.mjs';
import { areas, fileInCommand } from '../areas.mjs';
import { currentContext, requireApp } from '../context.mjs';
import { activeTestRun, listJobs } from '../jobs.mjs';

const DAY = 24 * 60 * 60 * 1000;

/** Test runs saved by the report archive: every run, from the terminal or the Studio. */
const uniq = (values) => [...new Set(values.filter(Boolean))];
/** One area (or several) as the item's filter fields. */
const scope = (list) => ({ sprints: uniq(list.flatMap((a) => a.sprints ?? [])), platforms: uniq(list.map((a) => a.platform)), modules: uniq(list.map((a) => a.module)) });

function runs(app, areaOf) {
  return savedRuns(app).map((r) => ({
    ...scope((r.tests ?? []).map((t) => areaOf(t.file))),
    sprints: r.sprint ? [r.sprint] : [],
    at: r.started,
    kind: 'run',
    who: r.testedBy ?? '',
    title: `Test run ${r.setupFailed ? 'login setup failed' : r.status}: ${r.passed}/${r.total} passed${r.failed ? `, ${r.failed} failed` : ''}`,
    detail: [r.command && `npx playwright ${r.command}`, r.environment, r.build && `build ${r.build}`, r.sprint && `sprint ${r.sprint}`].filter(Boolean).join(' · '),
    status: r.setupFailed ? 'failed' : r.status,
    link: { page: 'reports', run: path.basename(r.dir) },
  }));
}

/** Commands started from QA Studio (Claude actions, trace checks, sprint reports, runs). */
function jobs(app, areaOf) {
  return listJobs()
    .filter((j) => !app || !j.command.includes('apps/') || j.command.includes(`apps/${app}/`))
    .map((j) => ({ ...jobScope(app, j, areaOf), at: j.startedAt, kind: 'studio', who: j.by ?? '', title: j.title, detail: j.command, status: j.status, link: { page: 'logs', job: j.id } }));
}

/** Filter fields of a Studio job: from the file it worked on (a /qa-* target, a spec), if any. */
export function jobScope(app, job, areaOf) {
  const file = app && fileInCommand(app, job.command);
  return file ? scope([areaOf(file)]) : { sprints: [], platforms: [], modules: [] };
}

/** Requirement stages recorded in the baselines (with their history). */
function stages(app, areaOf) {
  const index = baselineIndex(path.join('apps', app));
  return Object.entries(index).flatMap(([file, entry]) =>
    (entry.history?.length ? entry.history : [entry]).map((h) => ({
      ...scope([areaOf(`apps/${app}/requirements/${file}`)]),
      at: h.at ?? `${h.date}T12:00:00`,
      kind: 'requirement',
      who: h.by ?? '',
      title: `${file.split('/').pop()}: ${h.stage}`,
      detail: h.note ?? '',
      status: h.stage,
      link: { page: 'requirements' },
    })),
  );
}

/** Developer MDs saved in sprints/sprint-NN/from-dev/<date>/. */
function handovers(app, areaOf) {
  const sprints = path.join('apps', app, 'sprints');
  if (!fs.existsSync(sprints)) return [];
  return fs.readdirSync(sprints).flatMap((sprint) => {
    const fromDev = path.join(sprints, sprint, 'from-dev');
    if (!/^sprint-\d+$/.test(sprint) || !fs.existsSync(fromDev)) return [];
    return fs
      .readdirSync(fromDev)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .map((date) => {
        const files = fs.readdirSync(path.join(fromDev, date)).filter((f) => f.endsWith('.md'));
        return {
          ...scope(files.map((f) => areaOf(`${fromDev}/${date}/${f}`.replace(/\\/g, '/')))),
          at: `${date}T09:00:00`,
          kind: 'handover',
          who: 'developers',
          title: `${files.length} developer MD(s) received for ${sprint.replace('-', ' ')}`,
          detail: files.join(', '),
          status: '',
          link: { page: 'requirements' },
        };
      });
  });
}

/** Recent git commits (who changed tests, models or requirements). */
function commits() {
  const log = spawnSync('git', ['log', '-n', '50', '--format=%aI%x09%an%x09%h%x09%s'], { encoding: 'utf8' });
  if (log.status !== 0) return [];
  return log.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [at, who, hash, subject] = line.split('\t');
      return { at, kind: 'commit', sprints: [], platforms: [], modules: [], who, title: subject, detail: `commit ${hash}`, status: '', link: null };
    });
}

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/activity$/,
    handler: ({ query }) => {
      const app = query.app ? requireApp(query.app) : currentContext().app;
      const days = Number(query.days) || 30;
      const since = Date.now() - days * DAY;
      const areaOf = app ? areas(app).areaOf : () => ({});
      const items = [...(app ? [...runs(app, areaOf), ...stages(app, areaOf), ...handovers(app, areaOf)] : []), ...jobs(app, areaOf), ...commits()]
        .filter((i) => i.at && Date.parse(i.at) >= since)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      return { app, days, running: activeTestRun() ?? null, items };
    },
  },
];
