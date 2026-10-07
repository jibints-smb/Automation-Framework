// Creates the folder skeleton for a new application under apps/<name>.
// Usage: npm run new:app -- <name> [--platforms web,mobile-web,android,ios,api]
import fs from 'node:fs';
import path from 'node:path';

const [name, ...rest] = process.argv.slice(2);
const platformsArg = rest[rest.indexOf('--platforms') + 1];
const platforms = rest.includes('--platforms') && platformsArg ? platformsArg.split(',') : ['web', 'mobile-web'];
const valid = ['web', 'mobile-web', 'android', 'ios', 'api'];

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

const folders = [
  'requirements',
  'test-cases',
  'sprints',
  'data',
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
    baseUrl: 'https://qa.example.com', // TODO: QA URL (BASE_URL in .env overrides it)
    testIdAttribute: 'data-testid', // attribute your developers use for test IDs
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
  // Uncomment when the app has a login. Each role's account comes from .env.
  // auth: {
  //   defaultRole: 'user',
  //   roles: {
  //     user: { usernameEnv: 'USER_USERNAME', passwordEnv: 'USER_PASSWORD' },
  //     admin: { usernameEnv: 'ADMIN_USERNAME', passwordEnv: 'ADMIN_PASSWORD' },
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
# USER_USERNAME=
# USER_PASSWORD=

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

console.log(`Created ${dir} (${platforms.join(', ')})

Next steps:
  1. Fill in ${dir}/app.config.ts (base URL, test-id attribute, login roles) and ${dir}/.env
  2. Put module MD files in ${dir}/requirements/ (template: templates/requirement.md)
  3. Run tests for this app:   set APP=${name} in the root .env, or  APP=${name} npm test
  4. In Claude: /qa-testcases ${dir}/requirements/<file>.md  then  /qa-automate ...
  5. Per sprint: copy templates/sprint.md to ${dir}/sprints/, send templates/dev-handover.md to the developers`);
