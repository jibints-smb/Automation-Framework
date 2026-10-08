// Reports: saved runs (reports/<app>/<run>/), their evidence, the live Allure report and the shared pages.
import fs from 'node:fs';
import path from 'node:path';
import { savedRuns } from '../../scripts/lib.mjs';
import { currentContext, listApps, requireApp } from '../context.mjs';
import { startJob } from '../jobs.mjs';

const RUN = /^[\w.-]+$/;

function runDir(app, run) {
  if (!RUN.test(run)) throw Object.assign(new Error('Unknown run'), { status: 404 });
  const dir = path.join('reports', requireApp(app), run);
  if (!fs.existsSync(path.join(dir, 'summary.json'))) throw Object.assign(new Error('Unknown run'), { status: 404 });
  return dir;
}

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/reports$/,
    handler: ({ query }) => {
      const apps = query.app ? [requireApp(query.app)] : listApps();
      const runs = apps.flatMap((app) =>
        savedRuns(app).map(({ tests, dir, ...r }) => {
          const run = path.basename(dir);
          return {
            ...r,
            run,
            reportUrl: r.report ? `/reports/${app}/${run}/${r.report}` : '',
            evidence: fs.existsSync(path.join(dir, 'evidence')) ? fs.readdirSync(path.join(dir, 'evidence')).filter((f) => !f.endsWith('.txt')).length : 0,
          };
        }),
      );
      runs.sort((a, b) => b.started.localeCompare(a.started));
      const app = query.app || currentContext().app;
      const pages = [
        { name: 'All saved runs (list)', url: '/reports/index.html', exists: fs.existsSync('reports/index.html') },
        { name: 'Flaky tests', url: '/reports/flaky.html', exists: fs.existsSync('reports/flaky.html') },
        { name: 'Traceability matrix', url: `/reports/${app}/traceability.html`, exists: !!app && fs.existsSync(`reports/${app}/traceability.html`) },
        ...(app && fs.existsSync(`reports/${app}`)
          ? fs.readdirSync(`reports/${app}`).filter((f) => /^sprint-\d+-report\.html$/.test(f)).map((f) => ({ name: `Sprint ${f.match(/\d+/)[0]} report`, url: `/reports/${app}/${f}`, exists: true }))
          : []),
        { name: 'Live Allure report (last run)', url: '/live-report/', exists: fs.existsSync('allure-report/index.html') },
      ];
      return { runs, pages };
    },
  },
  {
    method: 'GET',
    path: /^\/api\/reports\/(?<app>[\w-]+)\/(?<run>[\w.-]+)$/,
    handler: ({ params }) => {
      const dir = runDir(params.app, params.run);
      const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
      const evidence = fs.existsSync(path.join(dir, 'evidence'))
        ? fs.readdirSync(path.join(dir, 'evidence')).map((f) => ({ name: f, url: `/reports/${params.app}/${params.run}/evidence/${f}` }))
        : [];
      return { ...summary, run: params.run, reportUrl: summary.report ? `/reports/${params.app}/${params.run}/${summary.report}` : '', evidence };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/reports\/live$/,
    handler: () => startJob({ kind: 'report', title: 'Build the live Allure report', npm: 'allure:generate', by: currentContext().qaName }),
  },
];
