// Jobs: commands started from the Studio (test runs, Claude actions, scripts), their output and Stop.
import { getJob, listJobs, stopJob, summary } from '../jobs.mjs';

export const routes = [
  { method: 'GET', path: /^\/api\/jobs$/, handler: () => listJobs() },
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
