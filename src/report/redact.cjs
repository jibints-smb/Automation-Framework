/**
 * Keeps secrets out of reports (CommonJS, so tests on Node 20 and the report scripts can both load it). Used in two places:
 *   1. while tests run (src/utils/redact.ts): step titles, errors, console/network logs, API errors, emails
 *   2. before a report is built (redactResultsDir): every string in the Allure results and every text
 *      attachment, as a safety net for anything step 1 missed (Allure's own error box, parameters, ...)
 *
 * What is masked: the values of secret settings (*PASSWORD*, *TOKEN*, *SECRET*, *API_KEY*, *PRIVATE_KEY*
 * from the .env files / environment), Bearer tokens, JWTs, and URL query values named like a token
 * (token, code, otp, key, sig, password, session...).
 * Videos and screenshots can't be redacted; password fields show as dots there. Traces are not kept by default
 * (REPORT_EVIDENCE, src/report/archive.ts).
 */
const fs = require('node:fs');
const path = require('node:path');

const MASK = '****';

/** Settings whose values are secrets. */
const SECRET_KEY = /(PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CLIENT_KEY|ACCESS_KEY)/i;
/** Shorter values are too likely to appear in normal text ("admin", "1234"). */
const MIN_SECRET_LENGTH = 6;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g;
const QUERY_SECRET = /([?&](?:token|access_token|refresh_token|id_token|code|otp|key|apikey|api_key|sig|signature|password|pwd|secret|session|sessionid|session_id|auth)=)[^&#\s"'<>]+/gi;
/** Text attachments that are redacted; binary ones (images, video, zip) are left as they are. */
const TEXT_FILE = /\.(txt|md|html?|json|csv|xml|log|properties)$/i;

/** Secret values from a set of KEY=VALUE settings, longest first (so a longer secret is masked whole). */
function secretsFrom(settings) {
  const values = Object.entries(settings)
    .filter(([key, value]) => SECRET_KEY.test(key) && typeof value === 'string' && value.trim().length >= MIN_SECRET_LENGTH)
    .map(([, value]) => value.trim());
  return [...new Set(values)].sort((a, b) => b.length - a.length);
}

/** Secrets from the environment plus the root and app .env files (for scripts that run outside the tests). */
function loadSecrets(rootDir = process.cwd()) {
  const settings = { ...readEnvFile(path.join(rootDir, '.env')) };
  const app = process.env.APP || settings.APP;
  const testEnv = process.env.TEST_ENV || settings.TEST_ENV || 'qa';
  if (app) {
    Object.assign(settings, readEnvFile(path.join(rootDir, 'apps', app, '.env')));
    Object.assign(settings, readEnvFile(path.join(rootDir, 'apps', app, `.env.${testEnv}`)));
  }
  return secretsFrom({ ...settings, ...process.env });
}

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const settings = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) settings[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return settings;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text with secrets replaced by ****. */
function redactText(text, secrets = []) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const secret of secrets) {
    if (out.includes(secret)) out = out.replace(new RegExp(escapeRegExp(secret), 'g'), MASK);
  }
  return out.replace(BEARER, `$1 ${MASK}`).replace(JWT, MASK).replace(QUERY_SECRET, `$1${MASK}`);
}

/** Every string inside a JSON value, redacted. */
function redactDeep(value, secrets) {
  if (typeof value === 'string') return redactText(value, secrets);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, secrets));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v, secrets)]));
  }
  return value;
}

/** Redacts an Allure results folder in place: result/container JSON and text attachments. Returns files changed. */
function redactResultsDir(dir, secrets = loadSecrets()) {
  if (!fs.existsSync(dir)) return 0;
  let changed = 0;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (!fs.statSync(file).isFile() || !TEXT_FILE.test(name)) continue;
    const before = fs.readFileSync(file, 'utf8');
    let after;
    if (/-(result|container)\.json$/.test(name)) {
      try {
        after = JSON.stringify(redactDeep(JSON.parse(before), secrets));
      } catch {
        after = redactText(before, secrets); // half-written file (interrupted run)
      }
    } else {
      after = redactText(before, secrets);
    }
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed++;
    }
  }
  return changed;
}

module.exports = { MASK, secretsFrom, loadSecrets, redactText, redactDeep, redactResultsDir };
