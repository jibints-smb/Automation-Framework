#!/usr/bin/env node
/**
 * Masks secrets in Allure results before a report is built (npm run report does this automatically):
 *   node scripts/redact-results.mjs [allure-results]
 * See src/report/redact.cjs for what is masked.
 */
import { loadSecrets, redactResultsDir } from '../src/report/redact.cjs';

const dir = process.argv[2] || 'allure-results';
try {
  redactResultsDir(dir, loadSecrets());
} catch (e) {
  console.warn(`redact-results: could not redact ${dir}: ${e.message}`);
  process.exitCode = 1; // don't build a report that may contain secrets
}
