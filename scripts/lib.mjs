// Shared helpers for the repo scripts (no dependencies).
import crypto from 'node:crypto';
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

/** A setting from the root .env (undefined when missing or empty). */
export function readRootEnv(key) {
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
      type: (row[columns.indexOf('type')] ?? '').toLowerCase(),
      priority: (row[columns.indexOf('priority')] ?? '').toLowerCase(),
      /** yes · later · no (manual only) · retired (removed from the requirement, never deleted: IDs stay unique) */
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

/** The Item | Value table at the top of a *.testcases.md file: source, jira, epic, feature, platform, spec. */
export function testCasesHeader(file) {
  const header = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\|\s*(Source|Jira|Epic|Feature|Platform|Spec file)\s*\|\s*([^|]*?)\s*\|/i);
    if (m) header[m[1].toLowerCase().replace(' file', '')] = m[2].replace(/`/g, '').trim();
  }
  return header;
}

/** Every Markdown table in a text, with the heading above it: rows are objects keyed by lower-case column name. */
export function mdTables(text) {
  const tables = [];
  let heading = '';
  let columns = null;
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) heading = h[1].trim();
    if (!line.trim().startsWith('|')) {
      columns = null;
      continue;
    }
    const row = cells(line);
    if (!columns) {
      columns = row.map((c) => c.toLowerCase());
      tables.push({ heading, rows: [] });
      continue;
    }
    if (row.every((c) => /^:?-+:?$/.test(c))) continue; // separator line
    tables.at(-1).rows.push(Object.fromEntries(columns.map((c, i) => [c, row[i] ?? ''])));
  }
  return tables;
}

/** Saved runs of an app (reports/<app>/<run>/summary.json), newest first. */
export function savedRuns(app) {
  const base = path.join('reports', app);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(base, d.name, 'summary.json')))
    .map((d) => {
      try {
        return { dir: path.join(base, d.name), ...JSON.parse(fs.readFileSync(path.join(base, d.name, 'summary.json'), 'utf8')) };
      } catch {
        return undefined;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.started.localeCompare(a.started));
}

/**
 * The latest automated result of every test-case ID across the saved runs (newest run first wins):
 * passed · failed · flaky · known bug · PO pending · skipped, with the run's date, build and the note.
 * Pass `filter(run)` to look only at some runs (e.g. one environment).
 */
export function latestResults(app, filter = () => true) {
  const results = new Map();
  for (const run of savedRuns(app).filter(filter)) {
    for (const t of run.tests ?? []) {
      const id = t.title.match(/\b(TC-[A-Z0-9-]+)\s*\|/i)?.[1];
      if (!id || results.has(id)) continue;
      const result =
        t.outcome === 'unexpected' ? 'failed'
        : t.outcome === 'flaky' ? 'flaky'
        : t.outcome === 'skipped' ? 'skipped'
        : t.note?.startsWith('Known bug') ? 'known bug'
        : t.note?.startsWith('Waiting for PO decision') ? 'PO pending'
        : 'passed';
      results.set(id, { result, note: t.note ?? '', started: run.started, build: run.build ?? '', environment: run.environment, run: run.dir });
    }
  }
  return results;
}

/**
 * Manual test results: apps/<app>/sprints/**\/manual-results.md, table columns
 * ID | Build | Result (pass / fail / blocked) | Tested by | Date | Bug | Notes. The latest date per ID wins.
 */
export function manualResults(appDir) {
  const results = new Map();
  for (const file of walk(path.join(appDir, 'sprints'), 'manual-results.md')) {
    for (const table of mdTables(fs.readFileSync(file, 'utf8'))) {
      for (const row of table.rows) {
        const id = row.id?.trim();
        if (!/^TC-[A-Z0-9-]+$/i.test(id ?? '') || !row.result) continue;
        const entry = { result: row.result.toLowerCase(), build: row.build ?? '', by: row['tested by'] ?? '', date: row.date ?? '', bug: row.bug ?? '', notes: row.notes ?? '', file };
        const known = results.get(id);
        if (!known || entry.date >= known.date) results.set(id, entry);
      }
    }
  }
  return results;
}

/** Requirement baselines of an app (requirements/.baseline/index.json). */
export function baselineIndex(appDir) {
  const file = path.join(appDir, 'requirements/.baseline/index.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

/** HTML-escape. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Hash of a requirement's meaningful content: ignores line endings, trailing spaces and HTML comments. */
export function requirementHash(text) {
  const normalized = text.replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
