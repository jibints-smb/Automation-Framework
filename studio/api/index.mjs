// Every API route of QA Studio, one module per screen.
import { routes as activity } from './activity.mjs';
import { routes as apps } from './apps.mjs';
import { routes as jobs } from './jobs.mjs';
import { routes as qa } from './qa.mjs';
import { routes as reports } from './reports.mjs';
import { routes as runs } from './runs.mjs';
import { routes as setup } from './setup.mjs';
import { routes as sprints } from './sprints.mjs';
import { routes as system } from './system.mjs';

export const routes = [...setup, ...system, ...apps, ...runs, ...reports, ...qa, ...sprints, ...jobs, ...activity];
