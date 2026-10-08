// QA Studio page logic (Alpine.js). One component on <body>; pages are sections shown by the URL hash (#/run).
const PAGES = ['home', 'setup', 'apps', 'requirements', 'testcases', 'sprints', 'run', 'reports', 'jobs'];

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-QA-Studio': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const fmtDuration = (sec) => (sec >= 3600 ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m` : sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec ?? 0}s`);

document.addEventListener('alpine:init', () => {
  Alpine.data('studio', () => ({
    page: 'home',
    ctx: {},
    toasts: [],
    loading: false,
    fmtDate,
    fmtDuration,

    // setup
    settings: [],
    settingsForm: {},
    secretForm: {},
    checks: [],
    checking: false,

    // apps
    apps: [],
    showNewApp: false,
    newApp: { name: '', platforms: ['web'], baseUrl: '', testId: 'data-testid', browsers: ['chrome'], locale: '', timezone: '', roles: [{ role: 'admin', usernameEnv: 'ADMIN_EMAIL', passwordEnv: 'ADMIN_PASSWORD' }], makeActive: true },
    selectedApp: null,
    envFile: '.env',
    envSettings: [],
    envForm: {},
    newEnvName: '',
    showAllEnv: false,

    // run
    runOptions: { projects: [], environments: [], stories: [], sprints: [], specs: [], testCases: [], tags: [] },
    runForm: { scope: 'all', value: '', projects: [], headed: false, workers: '', retries: '', environment: '', build: '', sprint: '' },
    job: null,
    jobLines: [],
    progress: { total: 0, done: 0 },
    stream: null,
    lastRun: null,

    // reports
    reports: { runs: [], pages: [] },
    reportFilter: '',
    selectedRun: null,

    // jobs
    jobs: [],
    selectedJob: null,

    // requirements
    reqs: { requirements: [], fromDev: [] },
    viewer: null,
    showNewReq: false,
    newReq: { platform: 'web', jira: '', module: '', title: '', content: '' },
    uploadSprint: '',

    // sprints
    sprintList: [],
    sprintNo: '',
    sprint: null,
    sprintTab: 'stories',
    newSprintNo: '',
    sprintReportOutput: '',
    rowForm: {},
    manualForm: { id: '', result: 'pass', build: '', bug: '', notes: '' },
    cellEdits: {},

    // test cases
    tc: { files: [], coverage: {} },
    tcFilter: '',
    tcResult: '',

    async init() {
      window.addEventListener('hashchange', () => this.route());
      await this.loadContext();
      // first time: nobody set up yet → Setup
      if (!this.ctx.qaName || !this.ctx.app) location.hash = '#/setup';
      this.route();
    },

    route() {
      const name = location.hash.replace(/^#\//, '').split('/')[0];
      this.page = PAGES.includes(name) ? name : 'home';
      this.load(this.page);
    },
    go(page) {
      location.hash = `#/${page}`;
    },

    async load(page) {
      try {
        if (page === 'home') await this.loadContext();
        if (page === 'setup') await Promise.all([this.loadSettings(), this.loadChecks()]);
        if (page === 'apps') await this.loadApps();
        if (page === 'run') await this.loadRunOptions();
        if (page === 'reports') await this.loadReports();
        if (page === 'jobs') await this.loadJobs();
        if (page === 'requirements') await this.loadRequirements();
        if (page === 'testcases') await this.loadTestCases();
        if (page === 'sprints') await this.loadSprints();
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },

    toast(message, kind = 'ok') {
      const id = Math.random();
      this.toasts.push({ id, message, kind });
      setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), kind === 'bad' ? 7000 : 3500);
    },

    // ───── context / home ─────
    async loadContext() {
      this.ctx = await api('GET', '/api/context');
    },
    runStatus(run) {
      if (!run) return { text: 'No runs yet', cls: 'badge-muted' };
      if (run.setupFailed) return { text: 'Login setup failed', cls: 'badge-bad' };
      return run.status === 'passed' ? { text: 'Passed', cls: 'badge-ok' } : run.status === 'interrupted' ? { text: 'Interrupted', cls: 'badge-warn' } : { text: 'Failed', cls: 'badge-bad' };
    },
    passRate(run) {
      if (!run) return 0;
      const counted = run.total - run.skipped - (run.knownBugs ?? 0) - (run.pendingDecisions ?? 0);
      return counted > 0 ? Math.round((run.passed / counted) * 100) : 0;
    },

    // ───── setup ─────
    async loadSettings() {
      const data = await api('GET', '/api/settings');
      this.settings = data.settings;
      this.settingsForm = Object.fromEntries(data.settings.filter((s) => !s.secret).map((s) => [s.key, s.value ?? '']));
      this.secretForm = {};
    },
    async saveSettings() {
      const changes = {};
      for (const s of this.settings) {
        if (s.secret) {
          if (this.secretForm[s.key] !== undefined && this.secretForm[s.key] !== '') changes[s.key] = this.secretForm[s.key];
        } else if ((this.settingsForm[s.key] ?? '') !== (s.value ?? '')) {
          changes[s.key] = this.settingsForm[s.key];
        }
      }
      if (!Object.keys(changes).length) return this.toast('Nothing changed');
      try {
        await api('POST', '/api/settings', { changes });
        this.toast('Settings saved');
        await Promise.all([this.loadSettings(), this.loadContext(), this.loadChecks()]);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async clearSecret(key) {
      await api('POST', '/api/settings', { changes: { [key]: null } });
      this.toast(`${key} removed`);
      await this.loadSettings();
    },
    async loadChecks() {
      this.checking = true;
      try {
        this.checks = (await api('GET', '/api/system')).checks;
      } finally {
        this.checking = false;
      }
    },
    async fix(action) {
      if (action === 'setup') return this.go('setup');
      if (action === 'app-settings') {
        this.go('apps');
        return this.openApp(this.ctx.app);
      }
      try {
        const job = await api('POST', `/api/system/${action}`);
        this.watchJob(job);
        this.toast(`${job.title}: started`);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },

    // ───── apps ─────
    async loadApps() {
      this.apps = await api('GET', '/api/apps');
      if (this.selectedApp) await this.openApp(this.selectedApp.app);
    },
    toggle(list, value) {
      const i = list.indexOf(value);
      if (i >= 0) list.splice(i, 1);
      else list.push(value);
    },
    addRole() {
      this.newApp.roles.push({ role: '', usernameEnv: '', passwordEnv: '' });
    },
    roleDefaults(r) {
      if (!r.role) return;
      const up = r.role.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
      if (!r.usernameEnv) r.usernameEnv = `${up}_EMAIL`;
      if (!r.passwordEnv) r.passwordEnv = `${up}_PASSWORD`;
    },
    async createApp() {
      try {
        const body = { ...this.newApp, roles: this.newApp.roles.filter((r) => r.role) };
        const result = await api('POST', '/api/apps', body);
        this.toast(`App ${result.app} created`);
        this.showNewApp = false;
        await Promise.all([this.loadApps(), this.loadContext()]);
        await this.openApp(result.app);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async openApp(app) {
      this.selectedApp = await api('GET', `/api/apps/${app}`);
      if (!this.selectedApp.envFiles.includes(this.envFile)) this.envFile = '.env';
      await this.loadEnv();
    },
    async loadEnv() {
      const data = await api('GET', `/api/apps/${this.selectedApp.app}/env/${this.envFile}`);
      this.envSettings = data.settings;
      this.envForm = Object.fromEntries(data.settings.filter((s) => !s.secret).map((s) => [s.key, s.value ?? '']));
    },
    visibleEnv() {
      return this.showAllEnv ? this.envSettings : this.envSettings.filter((s) => s.set || !s.commented || /USERNAME|EMAIL|PASSWORD|BASE_URL|OTP/.test(s.key));
    },
    async saveEnv() {
      const changes = {};
      for (const s of this.envSettings) {
        const v = this.envForm[s.key];
        if (s.secret) {
          if (v) changes[s.key] = v;
        } else if ((v ?? '') !== (s.value ?? '') && !(s.commented && !v)) {
          changes[s.key] = v;
        }
      }
      if (!Object.keys(changes).length) return this.toast('Nothing changed');
      try {
        await api('POST', `/api/apps/${this.selectedApp.app}/env/${this.envFile}`, { changes });
        this.toast(`${this.envFile} saved`);
        await this.loadEnv();
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async addEnvironment() {
      try {
        const result = await api('POST', `/api/apps/${this.selectedApp.app}/environments`, { name: this.newEnvName });
        this.toast(`${result.file} created: fill in its URL and accounts`);
        this.newEnvName = '';
        this.envFile = result.file;
        await this.openApp(this.selectedApp.app);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async makeActive(app) {
      await api('POST', '/api/settings', { changes: { APP: app } });
      this.toast(`${app} is the active app`);
      await this.loadContext();
    },

    // ───── run tests ─────
    async loadRunOptions() {
      if (!this.ctx.app) return;
      this.runOptions = await api('GET', `/api/run-options?app=${this.ctx.app}`);
      if (!this.runForm.environment) this.runForm.environment = this.ctx.environment;
      if (!this.runForm.build) this.runForm.build = this.ctx.build;
      if (!this.runForm.sprint) this.runForm.sprint = this.ctx.sprint;
    },
    async startRun(preset) {
      if (preset) Object.assign(this.runForm, { scope: preset, value: '' });
      try {
        const job = await api('POST', '/api/runs', { ...this.runForm, app: this.ctx.app });
        if (this.page !== 'run') this.go('run');
        this.watchJob(job);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    watchJob(job) {
      this.stream?.close();
      this.job = job;
      this.jobLines = [];
      this.lastRun = null;
      this.progress = { total: 0, done: 0 };
      const stream = new EventSource(`/api/jobs/${job.id}/stream`);
      this.stream = stream;
      stream.onmessage = async (msg) => {
        const event = JSON.parse(msg.data);
        if (event.type === 'line') {
          this.jobLines.push(event.line);
          if (this.jobLines.length > 3000) this.jobLines.splice(0, 500);
          const total = event.line.match(/Running (\d+) tests? using/);
          if (total) this.progress.total = Number(total[1]);
          if (/^\s+(ok|x|✘|-|✓)\s+\d+\s/.test(event.line)) this.progress.done++;
          this.$nextTick(() => {
            const el = document.getElementById('job-log');
            if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
          });
        } else if (event.type === 'end') {
          stream.close();
          this.job = event.job ?? this.job;
          if (this.job?.kind === 'test') {
            const reports = await api('GET', `/api/reports?app=${this.ctx.app}`).catch(() => ({ runs: [] }));
            const latest = reports.runs[0];
            if (latest && latest.started >= this.job.startedAt.slice(0, 19)) this.lastRun = latest;
          }
          this.toast(`${this.job.title}: ${this.job.status}`, this.job.status === 'passed' ? 'ok' : 'bad');
          this.loadContext();
          if (this.page === 'setup') this.loadChecks();
          if (this.page === 'jobs') {
            await this.loadJobs();
            if (this.selectedJob?.id === this.job.id) this.selectedJob = { ...this.job, lines: [...this.jobLines] };
          }
        }
      };
    },
    async stopJob() {
      if (this.job) await api('POST', `/api/jobs/${this.job.id}/stop`);
    },
    progressPct() {
      return this.progress.total ? Math.min(100, Math.round((this.progress.done / this.progress.total) * 100)) : 0;
    },

    // ───── reports ─────
    async loadReports() {
      this.reports = await api('GET', `/api/reports${this.ctx.app ? `?app=${this.ctx.app}` : ''}`);
    },
    filteredRuns() {
      const q = this.reportFilter.toLowerCase();
      return this.reports.runs.filter((r) => !q || JSON.stringify([r.started, r.status, r.testedBy, r.build, r.sprint, r.environment, r.command]).toLowerCase().includes(q));
    },
    async openRun(run) {
      this.selectedRun = await api('GET', `/api/reports/${run.app}/${run.run}`);
    },
    async buildLiveReport() {
      try {
        const job = await api('POST', '/api/reports/live');
        this.watchJob(job);
        this.toast('Building the live report…');
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },

    // ───── requirements ─────
    async loadRequirements() {
      this.reqs = await api('GET', `/api/requirements?app=${this.ctx.app}`);
      if (!this.uploadSprint) this.uploadSprint = this.ctx.sprint || this.ctx.open?.latestSprint || '01';
    },
    reqBadge(status) {
      return { changed: 'badge-warn', 'needs test cases': 'badge-info', 'baseline missing': 'badge-warn', 'up to date': 'badge-ok' }[status] ?? 'badge-muted';
    },
    async view(file) {
      try {
        this.viewer = await api('GET', `/api/requirements/file?app=${this.ctx.app}&path=${encodeURIComponent(file)}`);
        this.$nextTick(() => document.getElementById('viewer')?.scrollIntoView({ behavior: 'smooth' }));
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async createRequirement() {
      try {
        const result = await api('POST', '/api/requirements', { ...this.newReq, app: this.ctx.app });
        this.toast(`Created ${result.file}`);
        this.showNewReq = false;
        this.newReq = { platform: 'web', jira: '', module: '', title: '', content: '' };
        await this.loadRequirements();
        await this.view(result.file);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async uploadDevMd(event) {
      const files = [...event.target.files];
      for (const file of files) {
        try {
          const result = await api('POST', '/api/requirements/upload', { app: this.ctx.app, sprint: this.uploadSprint, filename: file.name, content: await file.text() });
          this.toast(`Saved ${result.file}`);
        } catch (e) {
          this.toast(e.message, 'bad');
        }
      }
      event.target.value = '';
      await this.loadRequirements();
    },
    async claude(command, target) {
      const what = { 'qa-testcases': 'generate test cases for', 'qa-automate': 'automate', 'qa-update': 'update the tests for', 'qa-fix': 'investigate the failing tests of' }[command];
      if (!confirm(`Ask Claude to ${what} ${target ? target.split('/').pop() : 'this app'}? It edits files in the project; review the changes afterwards (git).`)) return;
      try {
        const job = await api('POST', `/api/claude/${command}`, { app: this.ctx.app, target });
        this.watchJob(job);
        this.selectedJob = job;
        this.go('jobs');
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },

    // ───── test cases ─────
    async loadTestCases() {
      this.tc = await api('GET', `/api/testcases?app=${this.ctx.app}`);
    },
    filteredCases(file) {
      const q = this.tcFilter.toLowerCase();
      return file.cases.filter(
        (c) => (!q || `${c.id} ${c.title} ${c.priority} ${c.note}`.toLowerCase().includes(q)) && (!this.tcResult || (this.tcResult === 'none' ? !c.result && !c.manual : (c.result || c.manual).startsWith(this.tcResult))),
      );
    },
    resultBadge(result) {
      if (!result) return 'badge-muted';
      if (/^(passed|pass|manual pass)/.test(result)) return 'badge-ok';
      if (/^(failed|fail|manual fail)/.test(result)) return 'badge-bad';
      return 'badge-warn';
    },
    async setAutomate(file, c, value) {
      try {
        await api('POST', '/api/testcases/automate', { app: this.ctx.app, file: file.file, id: c.id, value });
        c.automate = value;
        this.toast(`${c.id}: Automate = ${value}`);
      } catch (e) {
        this.toast(e.message, 'bad');
        await this.loadTestCases();
      }
    },
    async traceCheck() {
      try {
        const job = await api('POST', '/api/trace', { app: this.ctx.app });
        this.watchJob(job);
        this.selectedJob = job;
        this.go('jobs');
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    runStory(jira) {
      Object.assign(this.runForm, { scope: 'story', value: jira });
      this.go('run');
    },

    // ───── sprints ─────
    async loadSprints() {
      const data = await api('GET', `/api/sprints?app=${this.ctx.app}`);
      this.sprintList = data.sprints;
      if (!this.sprintNo || !this.sprintList.some((s) => s.number === this.sprintNo)) {
        const wanted = (this.ctx.sprint || '').padStart(2, '0');
        this.sprintNo = this.sprintList.some((s) => s.number === wanted) ? wanted : (this.sprintList.at(-1)?.number ?? '');
      }
      const next = Number(this.sprintList.at(-1)?.number ?? 0) + 1;
      this.newSprintNo = String(next).padStart(2, '0');
      if (this.sprintNo) await this.openSprint(this.sprintNo);
    },
    async openSprint(n) {
      this.sprintNo = n;
      this.sprint = await api('GET', `/api/sprints/${this.ctx.app}/${n}`);
      this.cellEdits = {};
      this.manualForm.build = this.ctx.build;
    },
    async startSprint() {
      try {
        const result = await api('POST', '/api/sprints', { app: this.ctx.app, number: this.newSprintNo });
        this.toast(`Sprint ${result.number} started`);
        if (confirm(`Make sprint ${result.number} your current sprint (recorded with every run)?`)) {
          await api('POST', '/api/settings', { changes: { SPRINT: result.number } });
          await this.loadContext();
        }
        this.sprintNo = result.number;
        await this.loadSprints();
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    sprintRows(table) {
      return (this.sprint?.tables?.[table]?.rows ?? []).filter((r) => Object.values(r).some((v) => v && !/^<.*>$/.test(v)));
    },
    async addSprintRow(table) {
      try {
        await api('POST', `/api/sprints/${this.ctx.app}/${this.sprintNo}/rows`, { table, values: this.rowForm[table] ?? {} });
        this.rowForm[table] = {};
        this.toast('Added');
        await this.openSprint(this.sprintNo);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async saveCell(table, key, column) {
      const id = `${table}|${key}|${column}`;
      try {
        await api('POST', `/api/sprints/${this.ctx.app}/${this.sprintNo}/cell`, { table, key, column, value: this.cellEdits[id] });
        this.toast('Saved');
        await this.openSprint(this.sprintNo);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    cell(table, key, column, current) {
      const id = `${table}|${key}|${column}`;
      if (!(id in this.cellEdits)) this.cellEdits[id] = current ?? '';
      return id;
    },
    async addManualResult() {
      try {
        await api('POST', `/api/sprints/${this.ctx.app}/${this.sprintNo}/manual`, this.manualForm);
        this.toast(`${this.manualForm.id}: ${this.manualForm.result} recorded`);
        this.manualForm = { id: '', result: 'pass', build: this.ctx.build, bug: '', notes: '' };
        await this.openSprint(this.sprintNo);
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    manualCandidates() {
      // cases that aren't automated first: those are the ones tested by hand
      const cases = this.sprint?.testCases ?? [];
      return [...cases.filter((c) => c.automate !== 'yes'), ...cases.filter((c) => c.automate === 'yes')];
    },
    async sprintReport() {
      try {
        const result = await api('POST', `/api/sprints/${this.ctx.app}/${this.sprintNo}/report`);
        this.sprintReportOutput = result.output;
        this.sprint.reportUrl = result.url;
        window.open(result.url, '_blank');
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async signOff(story) {
      if (!confirm(`Sign off ${story.jira} (${story.story}) as ${this.ctx.qaName}? It is refused while a test fails, waits for the PO, or the requirement changed.`)) return;
      try {
        const job = await api('POST', `/api/sprints/${this.ctx.app}/signoff`, { requirement: story['requirement file'] });
        this.watchJob(job);
        this.selectedJob = job;
        this.go('jobs');
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },

    // ───── jobs ─────
    async loadJobs() {
      this.jobs = await api('GET', '/api/jobs');
    },
    watching() {
      return !!(this.selectedJob && this.job && this.selectedJob.id === this.job.id);
    },
    selectedStatus() {
      return this.watching() ? this.job.status : this.selectedJob?.status;
    },
    jobOutput() {
      // the job being watched shows its live lines; others their saved output
      return this.watching() ? this.jobLines : (this.selectedJob?.lines ?? []);
    },
    async openJob(id) {
      try {
        this.selectedJob = await api('GET', `/api/jobs/${id}`);
      } catch {
        this.selectedJob = { ...this.jobs.find((j) => j.id === id), lines: ['(output of jobs from an earlier Studio session is not kept)'] };
      }
    },
    jobBadge(status) {
      return { passed: 'badge-ok', failed: 'badge-bad', stopped: 'badge-warn', running: 'badge-info' }[status] ?? 'badge-muted';
    },
  }));
});
