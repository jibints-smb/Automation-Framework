// Reads and updates .env files for QA Studio, keeping every comment, blank line and the order of settings.
// Secret values (passwords, tokens, webhooks, keys) are never returned: only whether they are set.
import fs from 'node:fs';

/** Settings whose values never leave the server (same rule as src/report/redact.cjs, plus webhooks / OTP / mail). */
export const SECRET_KEY = /(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CLIENT_KEY|ACCESS_KEY|WEBHOOK|OTP_CODE|TOTP)/i;
const LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;
const COMMENTED = /^\s*#\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

/** A value as dotenv reads it: a quoted value is kept whole (a # inside stays), an unquoted one ends at " #". */
function parseValue(raw) {
  const t = raw.trim();
  const q = t[0];
  if (q === '"' || q === "'") {
    const end = t.lastIndexOf(q);
    const inner = end > 0 ? t.slice(1, end) : t.slice(1);
    return q === '"' ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner;
  }
  return t.replace(/\s+#.*$/, '').trim();
}

/** Every setting in the file: { key, value, secret, set, commented, comment } (value omitted for secrets). */
export function readEnv(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const seen = new Map();
  let comment = [];
  for (const line of lines) {
    const active = line.match(LINE);
    const commented = !active && line.match(COMMENTED);
    const m = active || commented;
    if (m) {
      const [, key, raw] = m;
      const value = active ? parseValue(raw) : '';
      const secret = SECRET_KEY.test(key);
      // an active line wins over a commented example of the same key
      if (!seen.has(key) || (active && seen.get(key).commented)) {
        seen.set(key, {
          key,
          value: secret ? undefined : value,
          example: commented ? parseValue(raw.replace(/\s+\(.*\)$/, '')) : undefined,
          secret,
          set: !!active && value !== '',
          commented: !active,
          comment: comment.join(' ').trim(),
        });
      }
      comment = [];
    } else if (/^\s*#/.test(line)) {
      comment.push(line.replace(/^\s*#\s?/, ''));
    } else if (!line.trim()) {
      comment = [];
    }
  }
  return [...seen.values()];
}

/** The plain value of one setting (server side only). */
export function envValue(file, key) {
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(LINE);
    if (m && m[1] === key) return parseValue(m[2]);
  }
  return undefined;
}

const quote = (value) => (/[\s#"'`]/.test(value) || value === '' ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value);

/**
 * Sets settings in place: an existing line is replaced, a commented example ("# KEY=") is turned into the
 * setting, anything else is added at the end. `null` removes the value (KEY= stays, empty).
 */
export function updateEnv(file, changes) {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text ? text.split(/\r?\n/) : [];
  for (const [key, raw] of Object.entries(changes)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid setting name "${key}"`);
    const value = raw === null ? '' : String(raw);
    if (/[\r\n]/.test(value)) throw new Error(`${key}: a value can't contain line breaks`);
    const line = `${key}=${value === '' ? '' : quote(value)}`;
    let i = lines.findIndex((l) => l.match(LINE)?.[1] === key);
    if (i < 0) i = lines.findIndex((l) => l.match(COMMENTED)?.[1] === key);
    if (i >= 0) lines[i] = line;
    else {
      if (lines.length && lines[lines.length - 1] === '') lines.splice(lines.length - 1, 0, line);
      else lines.push(line);
    }
  }
  fs.writeFileSync(file, lines.join(eol).replace(/(\r?\n)?$/, eol));
}
