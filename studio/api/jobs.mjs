// Jobs: commands started from the Studio (test runs, Claude actions, scripts), their output and Stop.
import { areas } from '../areas.mjs';
import { requireApp } from '../context.mjs';
import { getJob, listJobs, stopJob, summary } from '../jobs.mjs';
import { jobScope } from './activity.mjs';

export const routes = [
  {
    method: 'GET',
    path: /^\/api\/jobs$/,
    // ?app=: only that app's jobs (and app-independent ones), each with its sprints / platforms / modules for the filter
    handler: ({ query }) => {
      if (!query.app) return listJobs();
      const app = requireApp(query.app);
      const { areaOf } = areas(app);
      return listJobs()
        .filter((j) => !j.command.includes('apps/') || j.command.includes(`apps/${app}/`))
        .map((j) => ({ ...j, ...jobScope(app, j, areaOf) }));
    },
  },
  {
    method: 'GET',
    path: /^\/api\/jobs\/(?<id>[\w-]+)$/,
    handler: ({ params }) => {
      const job = getJob(params.id);
      if (!job) throw Object.assign(new Error('Unknown job'), { status: 404 });
      return { ...summary(job), lines: job.lines };
    },
  },
  {
    method: 'POST',
    path: /^\/api\/jobs\/(?<id>[\w-]+)\/stop$/,
    handler: ({ params }) => ({ stopped: stopJob(params.id) }),
  },
];
