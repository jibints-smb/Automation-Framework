/**
 * Reads the reviewed test cases (apps/<app>/test-cases/**\/*.testcases.md) so the report can show,
 * for every automated test, what it checks: preconditions, steps and the expected result.
 * Tests are matched by the ID at the start of their title: "TC-LOGIN-02 | ...".
 */
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR } from '@core/config/env';

export interface TestCase {
  id: string;
  title: string;
  type: string;
  priority: string;
  steps: string[];
  expected: string;
  preconditions: string[];
  /** Header of the test-cases file: Source, Jira, Epic, Feature, Platform, Spec file. */
  header: Record<string, string>;
  /** Path relative to the app folder. */
  file: string;
}

let cache: TestCase[] | undefined;

/** The test case a test automates, from the ID at the start of its title. */
export function findTestCase(testTitle: string, specFile?: string): TestCase | undefined {
  const id = testCaseId(testTitle);
  if (!id) return undefined;
  const matches = loadAll().filter((tc) => tc.id.toUpperCase() === id.toUpperCase());
  if (matches.length <= 1 || !specFile) return matches[0];
  // same ID in two files: prefer the one whose "Spec file" is this spec
  const spec = specFile.replace(/\\/g, '/');
  return matches.find((tc) => tc.header['spec file'] && spec.endsWith(tc.header['spec file'])) ?? matches[0];
}

export function testCaseId(testTitle: string): string | undefined {
  return testTitle.match(/^\s*(TC-[A-Z0-9-]+)\s*\|/i)?.[1];
}

function loadAll(): TestCase[] {
  cache ??= walk(path.join(APP_DIR, 'test-cases')).flatMap(parseFile);
  return cache;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name.startsWith('.') ? [] : walk(full);
    return e.name.endsWith('.testcases.md') ? [full] : [];
  });
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function parseFile(file: string): TestCase[] {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const header: Record<string, string> = {};
  const preconditions: string[] = [];
  const rows: Record<string, string>[] = [];
  let section = '';
  let columns: string[] | null = null;

  for (const line of lines) {
    const heading = line.match(/^#{2,}\s+(.*)$/);
    if (heading) {
      section = heading[1].trim().toLowerCase();
      columns = null;
      continue;
    }
    if (!line.trim().startsWith('|')) {
      columns = null;
      if (section.startsWith('precondition')) {
        const item = line.match(/^\s*[-*]\s+(.+)$/)?.[1];
        if (item && item !== '...') preconditions.push(item.trim());
      }
      continue;
    }
    const row = cells(line);
    if (!columns) {
      columns = row.map((c) => c.toLowerCase());
      continue;
    }
    if (row.every((c) => /^:?-*:?$/.test(c))) continue; // separator line
    const record = Object.fromEntries(columns.map((c, i) => [c, row[i] ?? '']));
    if (columns[0] === 'item' && columns[1] === 'value') header[record.item.toLowerCase()] = record.value.replace(/`/g, '');
    else if (/^TC-[A-Z0-9-]+$/i.test(record.id ?? '')) rows.push(record);
  }

  const relFile = path.relative(APP_DIR, file).replace(/\\/g, '/');
  return rows.map((r) => ({
    id: r.id,
    title: r.title ?? '',
    type: r.type ?? '',
    priority: (r.priority ?? '').toLowerCase(),
    steps: splitSteps(r.steps ?? ''),
    expected: r['expected result'] ?? r.expected ?? '',
    preconditions,
    header,
    file: relFile,
  }));
}

/** "1. Enter user 2. Click Login" (or "<br>"-separated) → ["Enter user", "Click Login"]. */
function splitSteps(text: string): string[] {
  return text
    .split(/<br\s*\/?>|\s+(?=\d+[.)]\s)/i)
    .map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}
