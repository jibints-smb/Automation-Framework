#!/usr/bin/env node
/**
 * Applies the company branding (src/report/brand.mjs) to a generated Allure report.
 *   node scripts/brand-report.mjs allure-report
 *   node scripts/brand-report.mjs reports/<app>/<run>/report.html --project <app> --env qa
 *   node scripts/brand-report.mjs --saved [<app>]   saved runs whose report isn't branded yet (made before the
 *                                                   branding existed): the header comes from each run's summary.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { brandReport } from '../src/report/brand.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes('--saved')) brandSaved(option('--saved'));
else brandOne();

function brandOne() {
  const target = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) || 'allure-report';
  try {
    const count = brandReport(target, { project: option('--project'), environment: option('--env') });
    if (!count) console.warn(`brand-report: no report pages found in ${target}`);
  } catch (e) {
    console.warn(`brand-report: could not brand ${target}: ${e.message}`);
  }
}

/** Every saved run of one app (or all apps) with a report that has no branding yet. */
function brandSaved(onlyApp) {
  const base = 'reports';
  const apps = onlyApp ? [onlyApp] : fs.existsSync(base) ? fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory()) : [];
  let done = 0;
  for (const app of apps) {
    const dir = path.join(base, app);
    if (!fs.existsSync(dir)) continue;
    for (const run of fs.readdirSync(dir)) {
      const summaryFile = path.join(dir, run, 'summary.json');
      if (!fs.existsSync(summaryFile)) continue;
      const s = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
      const report = s.report && path.join(dir, run, s.report);
      if (!report || !fs.existsSync(report) || fs.readFileSync(report, 'utf8').includes('id="nas-brand"')) continue;
      const start = Date.parse(s.started);
      brandReport(report, {
        project: s.app ?? app,
        environment: s.environment,
        testedBy: s.testedBy ?? '', // never today's QA for an old run that recorded no tester
        build: s.build ?? '',
        sprint: s.sprint ?? '',
        run: {
          total: s.total,
          passed: s.passed,
          failed: s.failed,
          broken: 0,
          skipped: s.skipped,
          knownBugs: s.knownBugs ?? 0,
          pendingDecisions: s.pendingDecisions ?? 0,
          setupFailed: !!s.setupFailed,
          start,
          stop: start + (s.durationSec ?? 0) * 1000,
        },
      });
      fs.writeFileSync(summaryFile, JSON.stringify({ ...s, branded: true }, null, 2));
      console.log(`branded ${path.join(dir, run, s.report)}`);
      done++;
    }
  }
  console.log(done ? `brand-report: ${done} saved report(s) branded.` : 'brand-report: every saved report is branded already.');
}
