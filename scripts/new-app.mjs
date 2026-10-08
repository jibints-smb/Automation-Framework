// Creates the folder skeleton for a new application under apps/<name>.
// Usage: npm run new:app -- <name> [--platforms web,mobile-web,android,ios,api]
//   optional (QA Studio's New app form fills them): --base-url <url> --test-id <attribute>
//   --browsers chrome,firefox,safari,edge --locale en-GB --timezone Europe/London
//   --roles admin:ADMIN_EMAIL:ADMIN_PASSWORD,user:USER_EMAIL:USER_PASSWORD   (first role = default)
import fs from 'node:fs';
import path from 'node:path';

const [name, ...rest] = process.argv.slice(2);
const platformsArg = rest[rest.indexOf('--platforms') + 1];
const platforms = rest.includes('--platforms') && platformsArg ? platformsArg.split(',') : ['web', 'mobile-web'];
const valid = ['web', 'mobile-web', 'android', 'ios', 'api'];
const flag = (name) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : undefined);
const baseUrl = flag('base-url');
const testId = flag('test-id');
const browsers = flag('browsers')?.split(',').filter(Boolean);
const locale = flag('locale');
const timezone = flag('timezone');
/** role:USERNAME_SETTING:PASSWORD_SETTING */
const roles = (flag('roles') ?? '')
  .split(',')
  .filter(Boolean)
  .map((r) => {
    const [role, usernameEnv, passwordEnv] = r.split(':');
    return { role, usernameEnv, passwordEnv };
  });
const badRole = roles.find((r) => !/^[a-z][a-zA-Z0-9]*$/.test(r.role ?? '') || !/^[A-Z][A-Z0-9_]*$/.test(r.usernameEnv ?? '') || !/^[A-Z][A-Z0-9_]*$/.test(r.passwordEnv ?? ''));
if (badRole) {
  console.error('--roles: role:USERNAME_SETTING:PASSWORD_SETTING, e.g. admin:ADMIN_EMAIL:ADMIN_PASSWORD (role in camelCase, settings in UPPER_CASE)');
  process.exit(1);
}
if (baseUrl && !/^https?:\/\/[^\s'"]+$/.test(baseUrl)) {
  console.error('--base-url must start with http:// or https://');
  process.exit(1);
}
const unknownBrowser = browsers?.find((b) => !['chrome', 'firefox', 'safari', 'edge'].includes(b));
if (unknownBrowser) {
  console.error(`Unknown browser "${unknownBrowser}". Use: chrome, firefox, safari, edge`);
  process.exit(1);
}
const safe = (v) => String(v).replace(/[^\w\-./:+]/g, '');

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Usage: npm run new:app -- <name> [--platforms web,mobile-web,android,ios,api]');
  console.error('Name: lower case, digits and dashes, e.g. "customer-portal".');
  process.exit(1);
}
const unknown = platforms.filter((p) => !valid.includes(p));
if (unknown.length) {
  console.error(`Unknown platform(s): ${unknown.join(', ')}. Use: ${valid.join(', ')}`);
  process.exit(1);
}

const dir = `apps/${name}`;
if (fs.existsSync(dir)) {
  console.error(`${dir} already exists.`);
  process.exit(1);
}

const hasWeb = platforms.includes('web') || platforms.includes('mobile-web');
const hasMobile = platforms.includes('android') || platforms.includes('ios');
const hasApi = platforms.includes('api');
const title = name.replace(/(^|-)(\w)/g, (_, dash, c) => (dash ? ' ' : '') + c.toUpperCase());

// requirements/ and test-cases/ are split by platform like the real apps (requirements/web/BK-1-login.md)
const kinds = [...(hasWeb ? ['web'] : []), ...(hasMobile ? ['mobile'] : []), ...(hasApi ? ['api'] : [])];
const folders = [
  ...kinds.flatMap((k) => [`requirements/${k}`, `test-cases/${k}`]),
  'sprints/sprint-01',
  'data',
  ...(hasWeb || hasMobile ? ['screenshots'] : []),
  ...(hasWeb ? ['models/web', 'pages', 'tests/web'] : []),
  ...(hasMobile ? ['models/mobile', 'screens', 'tests/mobile'] : []),
  ...(hasApi ? ['models/api', 'tests/api'] : []),
];
for (const folder of folders) {
  fs.mkdirSync(path.join(dir, folder), { recursive: true });
  fs.writeFileSync(path.join(dir, folder, '.gitkeep'), '');
}

const files = {
  'app.config.ts': `/**
 * ${title}: application settings. Per-environment values (URLs, accounts, app builds) go in .env.
 */
import { defineApp } from '@core/config/app';

export default defineApp({
  name: '${title}',
  platforms: ${JSON.stringify(platforms).replace(/,/g, ', ')},
${
  hasWeb
    ? `
  web: {
    baseUrl: '${baseUrl ? safe(baseUrl) : 'https://qa.example.com'}',${baseUrl ? '' : ' // TODO: QA URL'} // BASE_URL in .env overrides it
    testIdAttribute: '${safe(testId || 'data-testid')}', // attribute your developers use for test IDs${
      browsers?.length ? `\n    browsers: ${JSON.stringify(browsers).replace(/,/g, ', ').replace(/"/g, "'")},` : ''
    }${locale ? `\n    locale: '${safe(locale)}',` : ''}${timezone ? `\n    timezoneId: '${safe(timezone)}',` : ''}
  },

  // Defaults for verify.accessible() / verify.performance() / verify.looksLike()
  // checks: {
  //   accessibility: { failOn: 'serious', ignoreRules: [] }, // WCAG 2.1 AA; ignore only ticketed issues
  //   performance: { fcp: 2500, load: 4000, kb: 2048 },      // ms / KB, per page load
  //   visualMaxDiffRatio: 0.01,
  // },
`
    : ''
}
  // Uncomment when the login page exists (/qa-automate creates it). Each role's account comes from .env.
  // auth: {
  //   defaultRole: '${roles[0]?.role ?? 'user'}',
  //   roles: {
${(roles.length ? roles : [{ role: 'user', usernameEnv: 'USER_USERNAME', passwordEnv: 'USER_PASSWORD' }, { role: 'admin', usernameEnv: 'ADMIN_USERNAME', passwordEnv: 'ADMIN_PASSWORD' }])
  .map((r) => `  //     ${r.role}: { usernameEnv: '${r.usernameEnv}', passwordEnv: '${r.passwordEnv}' },`)
  .join('\n')}
  //   },${
    hasWeb
      ? `
  //   login: async (page, credentials) => {
  //     const loginPage = new LoginPage(page);
  //     await loginPage.open();
  //     await loginPage.login(credentials);
  //     await loginPage.expectLoggedIn();
  //   },`
      : ''
  }
  // },
${
  hasMobile
    ? `
  // mobile: {
  //   // React Native apps: lets { id: '<testID>' } locators work on Android
  //   capabilities: { android: { 'appium:disableIdLocatorAutocompletion': true } },
  //   // native tests start logged in as their role (test.use({ role: null }) = login screen)
  //   login: async ({ driver, platform }, credentials) => {
  //     const loginScreen = new LoginScreen(driver, platform);
  //     await loginScreen.login(credentials);
  //     await new HomeScreen(driver, platform).expectLoaded();
  //   },
  // },
`
    : ''
}});
`,
  'fixtures.ts': `/**
 * The \`test\` every ${title} spec imports: core fixtures (role, api, cleanup, driver)
 * plus this app's pages and screens.
 *
 *   import { test, expect } from '@apps/${name}/fixtures';
 */
import { test as core } from '@core/fixtures';

/** Register every page and screen of this app here so tests can ask for it by name. */
type AppFixtures = {
  // loginPage: LoginPage;
};

export const test = core.extend<AppFixtures>({
  // loginPage: async ({ page }, use) => {
  //   await use(new LoginPage(page));
  // },
});

export { expect } from '@core/fixtures';
`,
  '.env.example': `# ${title} settings. Copy to .env (and .env.staging etc. for other environments).
# QA test accounts only — never production credentials. Never commit .env files.
${hasWeb ? '\n# BASE_URL=\n# TEST_ID_ATTRIBUTE=\n' : ''}
# Accounts per role (names used in app.config.ts → auth.roles)
${roles.length ? roles.map((r) => `${r.usernameEnv}=\n${r.passwordEnv}=`).join('\n') : '# USER_USERNAME=\n# USER_PASSWORD='}

# API_BASE_URL=
# API_TOKEN=

# Start of names of records the tests create (testDataName), so leftovers are easy to find
# TEST_DATA_PREFIX=qa-auto

# Test mailbox for OTP / verification emails (mailbox fixture). Dedicated QA Gmail, not a personal one.
# Gmail: 2-step verification on, then an app password. Check with: npm run mail:check
# MAIL_USER=qa.mysite@gmail.com
# MAIL_PASSWORD=
# MAIL_IMAP_HOST=imap.gmail.com      (Outlook: outlook.office365.com)
# MAIL_WAIT_SECONDS=60
${
  hasMobile
    ? `
APPIUM_URL=http://127.0.0.1:4723
ANDROID_DEVICE=emulator-5554
ANDROID_APP=
ANDROID_APP_PACKAGE=
ANDROID_APP_ACTIVITY=
IOS_DEVICE=iPhone 15
IOS_APP=
IOS_BUNDLE_ID=
`
    : ''
}`,
};
for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content);
fs.copyFileSync(path.join(dir, '.env.example'), path.join(dir, '.env'));

// the first sprint's tracker and manual-results file (npm run sprint:new -- <NN> for the next ones)
const fill = (text) => text.replaceAll('<NN>', '01').replaceAll('<app>', name);
fs.writeFileSync(path.join(dir, 'sprints/sprint-01.md'), fill(fs.readFileSync('templates/sprint.md', 'utf8')));
fs.writeFileSync(path.join(dir, 'sprints/sprint-01/manual-results.md'), fill(fs.readFileSync('templates/manual-results.md', 'utf8')));
fs.rmSync(path.join(dir, 'sprints/sprint-01/.gitkeep'), { force: true });

console.log(`Created ${dir} (${platforms.join(', ')})

Next steps:
  1. Fill in ${dir}/app.config.ts (base URL, test-id attribute, login roles) and ${dir}/.env (accounts; never committed)
  2. Make it the active app: APP=${name} in the root .env (also set QA_NAME, and BUILD_VERSION / SPRINT per build)
     One command only:  PowerShell  $env:APP='${name}'; npm test    ·    Git Bash  APP=${name} npm test
  3. Put each story's MD in ${dir}/requirements/${kinds[0] ?? 'web'}/<JIRA>-<module>.md (template: templates/requirement.md)
  4. In Claude: /qa-testcases <requirement.md>  →  QA reviews  →  /qa-automate <testcases.md>
  5. Sprint 01 is ready: ${dir}/sprints/sprint-01.md (+ sprint-01/manual-results.md); send templates/dev-handover.md
     to the developers. At sprint end: npm run sprint:report -- 01`);
