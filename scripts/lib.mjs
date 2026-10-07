// Shared helpers for the repo scripts (no dependencies).
import fs from 'node:fs';
import path from 'node:path';

/** All files under `dir` ending with `suffix` (skips node_modules and dot-folders). */
export function walk(dir, suffix) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(full, suffix);
    return e.name.endsWith(suffix) ? [full] : [];
  });
}

/** Forward-slash path relative to `from`. */
export function rel(from, file) {
  return path.relative(from, file).replace(/\\/g, '/');
}

/**
 * Which app to work on: from a path inside apps/<app>/, an explicit name, APP, the root .env,
 * or the only app that exists.
 */
export function resolveApp(hint) {
  const fromPath = hint?.replace(/\\/g, '/').match(/(?:^|\/)apps\/([^/]+)/)?.[1];
  const apps = fs.existsSync('apps') ? fs.readdirSync('apps').filter((a) => fs.existsSync(`apps/${a}/app.config.ts`)) : [];
  const app =
    fromPath ?? (hint && apps.includes(hint) ? hint : undefined) ?? process.env.APP ?? readRootEnv('APP') ?? (apps.length === 1 ? apps[0] : undefined);
  if (!app || !apps.includes(app)) {
    console.error(`App not found: "${app ?? ''}". Available: ${apps.join(', ') || 'none'}. Pass a path under apps/<app>/ or set APP.`);
    process.exit(1);
  }
  return { app, appDir: `apps/${app}` };
}

function readRootEnv(key) {
  if (!fs.existsSync('.env')) return undefined;
  return fs.readFileSync('.env', 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1].trim() || undefined;
}

/** Split a Markdown table line into trimmed cells. */
export function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Test cases (ID, title, automate) from a *.testcases.md file. */
export function parseCases(file) {
  const result = [];
  let columns = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) {
      columns = null;
      continue;
    }
    const row = cells(line);
    if (!columns) {
      columns = row.map((c) => c.toLowerCase());
      continue;
    }
    const id = row[columns.indexOf('id')];
    if (!id || !/^TC-[A-Z0-9-]+$/i.test(id)) continue;
    result.push({
      id,
      title: row[columns.indexOf('title')] ?? '',
      automate: (row[columns.indexOf('automate')] || 'yes').toLowerCase(),
      file,
    });
  }
  return result;
}

/** The "Source" requirement path written in a test-cases file header (relative to the app folder). */
export function testCasesSource(file, appDir) {
  const match = fs.readFileSync(file, 'utf8').match(/^\|\s*Source\s*\|\s*([^|]+?)\s*\|/im);
  if (!match) return undefined;
  return match[1].replace(/`/g, '').replace(/\\/g, '/').replace(new RegExp(`^${appDir}/`), '');
}

/** All TypeScript source of an app, for finding which test-case IDs are automated. */
export function appCode(appDir) {
  return walk(appDir, '.ts')
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n');
}

export function isAutomated(id, code) {
  return new RegExp(`['"\`@]${id}['"\`|\\s]`).test(code);
}
