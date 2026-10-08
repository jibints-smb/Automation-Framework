// Safe edits of Markdown tables for QA Studio: change one cell or add one row, leaving every other line of the
// file exactly as it was (the files stay readable and diff-friendly for git, the CLI and Claude).
import { cells } from '../scripts/lib.mjs';

const isRow = (line) => line.trim().startsWith('|');
const isSeparator = (line) => /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(line);
const escapeCell = (v) => String(v ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();

/** Tables in the text: { heading, headerLine, columns[], rows: [{ line, cells[] }] } with line numbers. */
function tables(lines) {
  const found = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^#{1,6}\s+(.*)$/);
    if (h) heading = h[1].trim();
    if (isRow(lines[i]) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const table = { heading, headerLine: i, columns: cells(lines[i]).map((c) => c.toLowerCase()), rows: [] };
      let j = i + 2;
      for (; j < lines.length && isRow(lines[j]); j++) table.rows.push({ line: j, cells: cells(lines[j]) });
      table.end = j; // first line after the table
      found.push(table);
      i = j - 1;
    }
  }
  return found;
}

/** The line with cell `index` replaced, keeping the other cells and the cell's padding width where possible. */
function replaceCell(line, index, value) {
  // split on the | that separate cells (not on escaped \|)
  const parts = line.split(/(?<!\\)\|/);
  const i = index + 1; // parts[0] is the text before the first |
  if (i >= parts.length - 1) throw new Error('Cell not found in the row');
  const width = parts[i].length;
  const cell = ` ${value} `;
  parts[i] = cell.length < width ? cell.padEnd(width) : cell;
  return parts.join('|');
}

function rowText(table, values) {
  return `| ${table.columns.map((c) => escapeCell(values[c])).join(' | ')} |`;
}

/**
 * Sets `column` of the row whose `keyColumn` equals `key`, in the first table (optionally under a heading
 * matching `heading`) that has both columns. Returns the new text; throws when the row isn't found.
 */
export function setCell(text, { heading, keyColumn, key, column, value }) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  for (const table of tables(lines)) {
    if (heading && !heading.test(table.heading)) continue;
    const k = table.columns.indexOf(keyColumn.toLowerCase());
    const c = table.columns.indexOf(column.toLowerCase());
    if (k < 0 || c < 0) continue;
    const row = table.rows.find((r) => r.cells[k] === key);
    if (!row) continue;
    if ((row.cells[c] ?? '') === escapeCell(value)) return text; // nothing to change
    lines[row.line] = replaceCell(lines[row.line], c, escapeCell(value));
    return lines.join(eol);
  }
  throw Object.assign(new Error(`Row "${key}" not found`), { status: 404 });
}

/** Adds a row to the first table under a heading matching `heading` (or the first table with these columns). */
export function addRow(text, { heading, values }) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const all = tables(lines);
  const table = all.find((t) => (heading ? heading.test(t.heading) : true) && Object.keys(values).every((k) => t.columns.includes(k.toLowerCase())));
  if (!table) throw Object.assign(new Error('Table not found'), { status: 404 });
  const lower = Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  // a template's empty placeholder row ("|  |  |") is replaced instead of kept above the new one
  const empty = table.rows.find((r) => r.cells.every((c) => !c || /^<.*>$/.test(c) || c === '—'));
  if (empty && table.rows.length === 1) lines[empty.line] = rowText(table, lower);
  else lines.splice(table.end, 0, rowText(table, lower));
  return lines.join(eol);
}

/** Rows of the first table under `heading`, as objects keyed by lower-case column (for forms). */
export function readRows(text, heading) {
  const table = tables(text.split(/\r?\n/)).find((t) => heading.test(t.heading));
  if (!table) return { columns: [], rows: [] };
  return {
    columns: table.columns,
    rows: table.rows.map((r) => Object.fromEntries(table.columns.map((c, i) => [c, r.cells[i] ?? '']))),
  };
}
