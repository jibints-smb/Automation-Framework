#!/usr/bin/env node
/**
 * Applies the company branding (src/report/brand.mjs) to a generated Allure report.
 *   node scripts/brand-report.mjs allure-report
 *   node scripts/brand-report.mjs reports/<app>/<run>/report.html --project <app> --env qa
 */
import { brandReport } from '../src/report/brand.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const target = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')) || 'allure-report';

try {
  const count = brandReport(target, { project: option('--project'), environment: option('--env') });
  if (!count) console.warn(`brand-report: no report pages found in ${target}`);
} catch (e) {
  console.warn(`brand-report: could not brand ${target}: ${e.message}`);
}
