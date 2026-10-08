// Requirement tracking: which version of each module MD file QA has processed, and what changed since.
//
//   npm run req:status [-- <app>]                       every module: stage, automation, CHANGED flag
//   npm run req:diff -- <requirement.md>                what changed since QA's last baseline
//   npm run req:baseline -- <requirement.md> --stage <cases|automated|signed-off> [--by "<name>", default QA_NAME] [--note "<text>"]
//                                                       record the current version as processed by QA
//
// Baselines live in apps/<app>/requirements/.baseline/ (commit them): a copy of the MD file plus index.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { appCode, cells, isAutomated, latestResults, parseCases, readRootEnv, rel, requirementHash, resolveApp, testCasesSource, walk } from './lib.mjs';

const STAGES = ['cases', 'automated', 'signed-off'];
const STAGE_LABEL = { cases: 'Test cases written', automated: 'Automated', 'signed-off': 'Signed off' };

const [command, ...args] = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));

if (command === 'status') status(positional[0]);
else if (command === 'diff') diff(requireFile(positional[0]));
else if (command === 'baseline') baseline(requireFile(positional[0]));
else {
  console.error('Usage: req-track.mjs status [app] | diff <file.md> | baseline <file.md> --stage <cases|automated|signed-off> [--by name] [--note text]');
  process.exit(1);
}

// ───────────────────────────── commands ─────────────────────────────

function status(appHint) {
  const { app, appDir } = resolveApp(appHint);
  const index = readIndex(appDir);
  const code = appCode(appDir);
  const caseFiles = walk(`${appDir}/test-cases`, '.testcases.md');
  const requirements = walk(`${appDir}/requirements`, '.md').filter((f) => !path.basename(f).startsWith('_'));

  const rows = requirements.map((file) => {
    const key = rel(`${appDir}/requirements`, file);
    const source = `requirements/${key}`;
    const linked = caseFiles.filter((f) => testCasesSource(f, appDir) === source);
    const cases = linked.flatMap(parseCases).filter((c) => c.automate === 'yes');
    const automated = cases.filter((c) => isAutomated(c.id, code)).length;
    const base = index[key];
    const changed = base ? base.hash !== hashOf(fs.readFileSync(file, 'utf8')) : false;
    return {
      module: key,
      jira: jiraKey(file),
      testCases: linked.length ? linked.map((f) => rel(appDir, f)).join(', ') : '—',
      automated: cases.length ? `${automated}/${cases.length}` : '—',
      stage: base ? `${STAGE_LABEL[base.stage]} ${base.date}${base.by ? ` (${base.by})` : ''}` : 'Not baselined',
      flag: !base ? (linked.length ? 'baseline missing' : 'NEW: needs test cases') : changed ? 'CHANGED since baseline' : '',
    };
  });

  console.log(`\nRequirement status for "${app}"\n`);
  printTable(rows, [
    ['Module MD', 'module'],
    ['Jira', 'jira'],
    ['Automated', 'automated'],
    ['Last QA stage', 'stage'],
    ['Attention', 'flag'],
  ]);
  const changed = rows.filter((r) => r.flag === 'CHANGED since baseline');
  const fresh = rows.filter((r) => r.flag.startsWith('NEW'));
  const unbaselined = rows.filter((r) => r.flag === 'baseline missing');
  console.log('');
  for (const r of changed) console.log(`⚠  ${r.module} changed after QA's last baseline → npm run req:diff -- ${appDir}/requirements/${r.module}   then /qa-update`);
  for (const r of fresh) console.log(`•  ${r.module} has no test cases yet → /qa-testcases ${appDir}/requirements/${r.module}`);
  for (const r of unbaselined) console.log(`•  ${r.module} has test cases but no baseline → npm run req:baseline -- ${appDir}/requirements/${r.module} --stage cases`);
  if (!changed.length && !fresh.length && !unbaselined.length) console.log('All modules are up to date with their QA baseline.');
  console.log('');
}

function diff(file) {
  const { appDir, key } = locate(file);
  const base = readIndex(appDir)[key];
  const baselineFile = path.join(appDir, 'requirements/.baseline', key);
  if (!base || !fs.existsSync(baselineFile)) {
    console.log(`\nNo QA baseline for ${key} yet: everything in it is new. Record one with:\n  npm run req:baseline -- ${file} --stage cases\n`);
    return;
  }
  const oldText = fs.readFileSync(baselineFile, 'utf8');
  const newText = fs.readFileSync(file, 'utf8');
  console.log(`\nChanges in ${key} since QA baseline "${STAGE_LABEL[base.stage]}" on ${base.date}${base.by ? ` by ${base.by}` : ''}\n`);
  if (hashOf(oldText) === hashOf(newText)) {
    console.log('No changes.\n');
    return;
  }
  const changes = compareRequirements(parseRequirement(oldText), parseRequirement(newText));
  console.log(changes.length ? changes.join('\n') : 'Only formatting/comments changed.');
  console.log(`\nNext: /qa-update ${file}   (updates test cases, model, data and specs for these changes)\n`);
}

function baseline(file) {
  const stage = flag('stage');
  if (!STAGES.includes(stage)) {
    console.error(`--stage must be one of: ${STAGES.join(', ')}`);
    process.exit(1);
  }
  const { appDir, key } = locate(file);
  const text = fs.readFileSync(file, 'utf8');
  const index = readIndex(appDir);
  // the QA recording it: --by, else QA_NAME (root .env)
  const by = flag('by') ?? process.env.QA_NAME ?? readRootEnv('QA_NAME') ?? '';
  if (stage === 'signed-off') checkSignOff(file, appDir, key, text, index[key], by);

  const target = path.join(appDir, 'requirements/.baseline', key);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  const now = new Date();
  const entry = { stage, date: now.toISOString().slice(0, 10), by, note: flag('note') ?? '', hash: hashOf(text) };
  // the latest entry on top (read by req:status), every earlier one kept in history
  const history = [...(index[key]?.history ?? []), { ...entry, at: now.toISOString() }];
  index[key] = { ...entry, history };
  fs.writeFileSync(indexPath(appDir), JSON.stringify(index, null, 2) + '\n');
  console.log(`Baseline recorded: ${key} → ${STAGE_LABEL[stage]} (${entry.date}${by ? `, ${by}` : ''})`);
}

/**
 * Signing off says "this story is tested and done". Refused when that isn't true yet (--force overrides the
 * test checks, never the name or AI checks):
 *   - run by an AI assistant (only a QA signs off) · no real name (--by / QA_NAME, not "QA Team")
 *   - the requirement changed after the last baseline (process it first: req:diff → /qa-update)
 *   - an "Automate: yes" case has no test · a test failed, didn't run, or waits for a PO decision
 */
function checkSignOff(file, appDir, key, text, base, by) {
  const refuse = (msg, overridable = true) => {
    if (overridable && args.includes('--force')) return console.warn(`! ${msg} (--force: signed off anyway)`);
    console.error(`Not signed off: ${msg}`);
    process.exit(1);
  };
  if (process.env.CLAUDECODE) refuse('sign-off is a QA decision; run this command yourself, not through an AI assistant.', false);
  if (!by || /^(qa|qa team|team|tester|test|admin)$/i.test(by.trim())) {
    refuse('give your own name: --by "<name>" or QA_NAME in the root .env.', false);
  }
  if (base && base.hash !== hashOf(text)) {
    refuse(`${key} changed after its "${STAGE_LABEL[base.stage]}" baseline (${base.date}). Process it first: npm run req:diff -- ${file}, /qa-update, then --stage automated.`);
  }

  const { app } = resolveApp(file);
  const source = `requirements/${key}`;
  const cases = walk(`${appDir}/test-cases`, '.testcases.md')
    .filter((f) => testCasesSource(f, appDir) === source)
    .flatMap(parseCases)
    .filter((c) => c.automate === 'yes');
  if (!cases.length) refuse(`no test cases are linked to ${source} (Source row of a test-cases file).`);
  const code = appCode(appDir);
  const missing = cases.filter((c) => !isAutomated(c.id, code)).map((c) => c.id);
  if (missing.length) refuse(`not automated yet: ${missing.join(', ')}.`);
  const results = latestResults(app);
  const notRun = cases.filter((c) => !results.has(c.id)).map((c) => c.id);
  const failed = cases.filter((c) => ['failed', 'skipped'].includes(results.get(c.id)?.result)).map((c) => c.id);
  const pending = cases.filter((c) => results.get(c.id)?.result === 'PO pending').map((c) => c.id);
  if (notRun.length) refuse(`no saved run has a result for: ${notRun.join(', ')}. Run the tests first.`);
  if (failed.length) refuse(`failing or skipped in the latest run: ${failed.join(', ')}.`);
  if (pending.length) refuse(`waiting for a PO decision: ${pending.join(', ')}.`);
}

// ───────────────────────────── requirement parsing ─────────────────────────────

/** Sections (by `##` heading) with their tables, list items and remaining text lines. */
function parseRequirement(text) {
  const clean = text.replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const sections = new Map();
  let current = newSection('Overview');
  sections.set(current.key, current);
  for (const line of clean.split('\n')) {
    const heading = line.match(/^##\s+(.*)/);
    if (heading) {
      current = newSection(heading[1]);
      sections.set(current.key, current);
    } else current.lines.push(line);
  }
  for (const section of sections.values()) parseBlocks(section);
  return sections;
}

function newSection(title) {
  const key = title.toLowerCase().replace(/^\d+\.\s*/, '').replace(/\(required\)/, '').trim();
  return { title: title.replace(/\(required\)/, '').trim(), key, lines: [], tables: [], items: new Map(), text: new Set() };
}

function parseBlocks(section) {
  const { lines } = section;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|')) {
      const block = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) block.push(lines[i++]);
      i--;
      section.tables.push(parseTable(block));
      continue;
    }
    const item = line.match(/^\s*(?:\d+\.|[-*])\s+(.*)/);
    if (item) {
      let body = item[1];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*(?:\d+\.|[-*])\s/.test(lines[i + 1])) {
        body += ' ' + lines[++i].trim();
      }
      body = squash(body);
      const id = body.replace(/\*\*/g, '').match(/^(AC\d+|BR\d+|TC-[\w-]+)\b/i)?.[1]?.toUpperCase();
      if (body) section.items.set(id ?? body, body);
      continue;
    }
    if (line.trim() && !line.startsWith('# ')) section.text.add(squash(line));
  }
}

function parseTable(block) {
  const header = cells(block[0]);
  const rows = block.slice(1).filter((l) => !/^\|?\s*:?-{2,}/.test(l.trim())).map(cells);
  const keyCol = header[0] === '#' || header[0] === '' ? 1 : 0;
  const map = new Map();
  for (const row of rows) {
    if (row.every((c) => !c)) continue;
    let key = row[keyCol] || row.join('|');
    if (map.has(key)) key = `${key} ${row[keyCol + 1] ?? ''}`.trim();
    map.set(key, row);
  }
  return { header, keyCol, rows: map, signature: header.join('|').toLowerCase() };
}

function compareRequirements(oldReq, newReq) {
  const out = [];
  for (const [key, section] of newReq) {
    const before = oldReq.get(key);
    const lines = before ? compareSection(before, section) : [`  + whole section added`];
    if (lines.length) out.push(`## ${section.title}`, ...lines, '');
  }
  for (const [key, section] of oldReq) if (!newReq.has(key)) out.push(`## ${section.title}`, '  - whole section removed', '');
  return out;
}

function compareSection(before, after) {
  const out = [];
  after.tables.forEach((table, i) => {
    const old = before.tables.find((t) => t.signature === table.signature) ?? before.tables[i];
    out.push(...compareTable(old, table));
  });
  for (const [id, text] of after.items) {
    if (!before.items.has(id)) out.push(`  + ADDED    ${text}`);
    else if (before.items.get(id) !== text) out.push(`  ~ CHANGED  ${id}\n      was: ${before.items.get(id)}\n      now: ${text}`);
  }
  for (const [id, text] of before.items) if (!after.items.has(id)) out.push(`  - REMOVED  ${text}`);
  for (const line of after.text) if (!before.text.has(line)) out.push(`  + text: ${line}`);
  for (const line of before.text) if (!after.text.has(line)) out.push(`  - text: ${line}`);
  return out;
}

function compareTable(old, table) {
  const out = [];
  const describe = (row) =>
    table.header
      .map((h, i) => (i !== table.keyCol && row[i] && h !== '#' ? `${h}: ${row[i]}` : ''))
      .filter(Boolean)
      .join('; ');
  if (!old) {
    for (const [key, row] of table.rows) out.push(`  + ADDED    ${key} (${describe(row)})`);
    return out;
  }
  if (old.signature !== table.signature) out.push(`  ~ table columns changed: ${old.header.join(' | ')}  →  ${table.header.join(' | ')}`);
  for (const [key, row] of table.rows) {
    const before = old.rows.get(key);
    if (!before) {
      out.push(`  + ADDED    ${key} (${describe(row)})`);
      continue;
    }
    const changes = table.header
      .map((h, i) => {
        const oi = old.header.indexOf(h);
        const was = oi >= 0 ? (before[oi] ?? '') : '';
        return h !== '#' && i !== table.keyCol && was !== (row[i] ?? '') ? `${h}: "${was}" → "${row[i] ?? ''}"` : '';
      })
      .filter(Boolean);
    if (changes.length) out.push(`  ~ CHANGED  ${key}: ${changes.join('; ')}`);
  }
  for (const [key] of old.rows) if (!table.rows.has(key)) out.push(`  - REMOVED  ${key}`);
  return out;
}

// ───────────────────────────── helpers ─────────────────────────────

function requireFile(file) {
  if (!file || !fs.existsSync(file)) {
    console.error(`Requirement file not found: ${file ?? '(none given)'}`);
    process.exit(1);
  }
  return file;
}

function locate(file) {
  const { appDir } = resolveApp(file);
  const key = rel(`${appDir}/requirements`, path.resolve(file)).replace(/^.*?apps\/[^/]+\/requirements\//, '');
  if (key.startsWith('..')) {
    console.error(`${file} is not inside ${appDir}/requirements/`);
    process.exit(1);
  }
  return { appDir, key };
}

function indexPath(appDir) {
  return path.join(appDir, 'requirements/.baseline/index.json');
}

function readIndex(appDir) {
  const p = indexPath(appDir);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
}

/** Hash of the meaningful content (shared with sprint:report): requirementHash in lib.mjs. */
function hashOf(text) {
  return requirementHash(text);
}

function jiraKey(file) {
  const text = fs.readFileSync(file, 'utf8');
  return text.match(/^\|\s*Jira\s*\|\s*([A-Z][A-Z0-9]+-\d+)/m)?.[1] ?? path.basename(file).match(/^[A-Z][A-Z0-9]+-\d+/)?.[0] ?? '';
}

function squash(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function printTable(rows, columns) {
  const widths = columns.map(([title, key]) => Math.max(title.length, ...rows.map((r) => String(r[key]).length)));
  const line = (values) => values.map((v, i) => String(v).padEnd(widths[i])).join('  ');
  console.log(line(columns.map(([title]) => title)));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const row of rows) console.log(line(columns.map(([, key]) => row[key])));
}
