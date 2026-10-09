// QA Viewer page logic (Alpine.js): the Studio's screens without actions. Nothing here changes a file; where the
// Studio has a button, the Viewer shows the command to type in the terminal or in Claude Code (cmd() + Copy).
// api(), fmtDate/fmtDuration and the badge helpers (`shared`) come from common.js.
const VIEWER_PAGES = ['home', 'apps', 'requirements', 'testcases', 'sprints', 'reports', 'activity', 'logs'];
const APP_KEY = 'qa-viewer-app';

/** localStorage can be missing or blocked: the Viewer then just uses the active app. */
const remembered = {
  get: () => {
    try {
      return localStorage.getItem(APP_KEY) || '';
    } catch {
      return '';
    }
  },
  set: (v) => {
    try {
      localStorage.setItem(APP_KEY, v);
    } catch {
      // not kept: fine
    }
  },
};

document.addEventListener('alpine:init', () => {
  Alpine.data('viewer', () => ({
    ...shared,
    viewerMode: true, // the test-case drawer shows the commands to type
    page: 'home',
    ctx: {},
    app: '',
    toasts: [],
    restartNeeded: false,
    copied: '',

    apps: [],
    appDetail: null,
    reqs: { requirements: [], fromDev: [] },
    viewer: null,
    compareView: null,
    tc: { files: [], coverage: {} },
    tcFilter: '',
    tcResult: '',
    sprintList: [],
    sprintNo: '',
    sprint: null,
    sprintTab: 'stories',
    reports: { runs: [], pages: [] },
    reportFilter: '',
    selectedRun: null,
    activity: { items: [], running: null },
    activityKind: '',
    activityWho: '',
    activityDays: 30,
    jobs: [],
    selectedJob: null,
    logTab: 'commands',
    logRun: '',
    logRunDetail: null,
    logOutcome: 'problems',

    async init() {
      window.addEventListener('hashchange', () => this.route());
      const checkHealth = () => api('GET', '/api/health').then((h) => (this.restartNeeded = h.restartNeeded)).catch(() => {});
      checkHealth();
      setInterval(checkHealth, 60_000);
      this.ctx = await api('GET', '/api/context');
      const saved = remembered.get();
      this.app = this.ctx.apps.includes(saved) ? saved : this.ctx.app || this.ctx.apps[0] || '';
      this.route();
    },
    route() {
      const [name, arg] = location.hash.replace(/^#\//, '').split('/');
      this.page = VIEWER_PAGES.includes(name) ? name : 'home';
      this.load(this.page, arg && decodeURIComponent(arg));
    },
    go(page, arg) {
      location.hash = `#/${page}${arg ? `/${encodeURIComponent(arg)}` : ''}`;
    },
    switchApp(app) {
      this.app = app;
      remembered.set(app);
      this.clearFilters(); // another app has other modules and sprints
      this.viewer = this.compareView = this.selectedRun = this.sprint = this.logRunDetail = null;
      this.sprintNo = this.logRun = '';
      this.load(this.page);
    },
    // App field of the filter bar: only what this browser shows (the root .env APP is not changed)
    currentApp() {
      return this.app;
    },
    filterApp(app) {
      this.switchApp(app);
    },
    q() {
      return `app=${encodeURIComponent(this.app)}`;
    },

    async load(page, arg) {
      try {
        this.ctx = await api('GET', '/api/context');
        if (!this.app) return;
        if (page === 'home') await Promise.all([this.loadReports(), this.loadRequirements(), this.loadTestCases(), this.loadActivity()]);
        if (page === 'apps') this.apps = await api('GET', '/api/apps');
        if (page === 'requirements') await this.loadRequirements();
        if (page === 'testcases') await this.loadTestCases();
        // the filter bar needs the requirements and test cases (its values, and the module of a story / test case)
        if (['sprints', 'reports', 'activity', 'logs'].includes(page)) await Promise.all([this.loadRequirements(), this.loadTestCases()]);
        if (page === 'sprints') await this.loadSprints();
        if (page === 'reports') {
          await this.loadReports();
          if (arg) await this.openRun(arg);
        }
        if (page === 'activity') await this.loadActivity();
        if (page === 'logs') {
          await Promise.all([this.loadJobs(), this.loadReports()]);
          if (arg) await this.openJob(arg);
        }
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },

    /** Copies a command for the terminal / Claude Code. Runs nothing. */
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.copied = text;
        setTimeout(() => this.copied === text && (this.copied = ''), 1500);
      } catch {
        this.toast('Copy not allowed by the browser: select the command and copy it', 'bad');
      }
    },
    /** Path relative to the repository root for an app-relative path from a tracker table. */
    appPath(rel) {
      return rel ? `apps/${this.app}/${rel.replace(/^apps\/[\w-]+\//, '')}` : '';
    },

    // ───── home ─────
    latestRun() {
      return this.reports.runs[0];
    },
    /** What to do next, as commands: the learning part of the Viewer. */
    nextSteps() {
      const steps = [];
      for (const r of this.reqs.requirements.filter((r) => r.changed)) {
        steps.push({ why: `${r.jira}: requirement changed since QA processed it`, cmds: [`npm run req:diff -- ${r.file}`, `/qa-update ${r.file}`] });
      }
      for (const d of this.reqs.fromDev.filter((d) => !d.merged && d.requirement)) {
        steps.push({ why: `${d.jira}: developer MD of ${d.date} not merged yet`, cmds: [`/qa-merge ${d.file}`] });
      }
      for (const r of this.reqs.requirements.filter((r) => !r.testCaseFiles.length)) {
        steps.push({ why: `${r.jira}: requirement without test cases`, cmds: [`/qa-testcases ${r.file}`] });
      }
      for (const f of this.tc.files) {
        const todo = f.cases.filter((c) => c.automate === 'yes' && !c.hasTest).length;
        if (todo) steps.push({ why: `${f.header.jira || f.file}: ${todo} case(s) marked Automate = yes without a test`, cmds: [`/qa-automate ${f.file}`] });
      }
      const run = this.latestRun();
      if (run?.setupFailed) steps.push({ why: 'Latest run: login setup failed (credentials changed?)', cmds: ['npm run auth'] });
      else if (run?.failed) steps.push({ why: `Latest run: ${run.failed} test(s) failed`, cmds: ['/qa-fix'] });
      return steps;
    },

    // ───── requirements ─────
    async loadRequirements() {
      this.reqs = await api('GET', `/api/requirements?${this.q()}`);
    },
    async view(file) {
      try {
        this.compareView = null;
        this.viewer = await api('GET', `/api/requirements/file?${this.q()}&path=${encodeURIComponent(file)}`);
        this.$nextTick(() => document.getElementById('viewer')?.scrollIntoView({ behavior: 'smooth' }));
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    async compare(dev) {
      try {
        const [left, right] = await Promise.all([
          api('GET', `/api/requirements/file?${this.q()}&path=${encodeURIComponent(dev.file)}`),
          api('GET', `/api/requirements/file?${this.q()}&path=${encodeURIComponent(dev.requirement)}`),
        ]);
        this.viewer = null;
        this.compareView = { dev: left, req: right };
        this.$nextTick(() => document.getElementById('compare')?.scrollIntoView({ behavior: 'smooth' }));
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },

    // ───── test cases ─────
    async loadTestCases() {
      this.tc = await api('GET', `/api/testcases?${this.q()}`);
    },
    filteredCases(file) {
      const q = this.tcFilter.toLowerCase();
      return file.cases.filter(
        (c) => (!q || `${c.id} ${c.title} ${c.priority} ${c.note}`.toLowerCase().includes(q)) && (!this.tcResult || (this.tcResult === 'none' ? !c.result && !c.manual : (c.result || c.manual).startsWith(this.tcResult))),
      );
    },
    automateBadge(value) {
      return { yes: 'badge-ok', later: 'badge-warn', no: 'badge-muted', retired: 'badge-muted' }[value] ?? 'badge-muted';
    },

    // ───── sprints ─────
    async loadSprints() {
      const data = await api('GET', `/api/sprints?${this.q()}`);
      this.sprintList = data.sprints;
      if (!this.sprintNo || !this.sprintList.some((s) => s.number === this.sprintNo)) {
        const wanted = (this.ctx.sprint || '').padStart(2, '0');
        this.sprintNo = this.sprintList.some((s) => s.number === wanted) ? wanted : (this.sprintList[this.sprintList.length - 1]?.number ?? '');
      }
      if (this.sprintNo) await this.openSprint(this.sprintNo);
      else this.sprint = null;
    },
    async openSprint(n) {
      this.sprintNo = n;
      this.sprint = await api('GET', `/api/sprints/${this.app}/${n}`);
    },
    sprintRows(table) {
      return (this.sprint?.tables?.[table]?.rows ?? []).filter((r) => Object.values(r).some((v) => v && !/^<.*>$/.test(v)));
    },
    signOffCmd(story) {
      return `npm run req:baseline -- ${this.appPath(story['requirement file'])} --stage signed-off --by "${this.ctx.qaName || '<your name>'}"`;
    },

    // ───── reports ─────
    async loadReports() {
      this.reports = await api('GET', `/api/reports?${this.q()}`);
    },
    filteredRuns() {
      const q = this.reportFilter.toLowerCase();
      return this.reports.runs.filter(
        (r) => this.matchesFilters(r) && (!q || JSON.stringify([r.started, r.status, r.testedBy, r.build, r.sprint, r.environment, r.command]).toLowerCase().includes(q)),
      );
    },
    async openRun(run) {
      try {
        this.selectedRun = await api('GET', `/api/reports/${this.app}/${run}`);
        // the run (and its report) opens below the runs table: bring it into view
        this.$nextTick(() => document.getElementById('run-detail')?.scrollIntoView({ behavior: 'smooth' }));
      } catch (e) {
        this.toast(e.message, 'bad');
      }
    },
    /** Tests of a run that need a look (failed, flaky, known bug, PO pending, skipped), within the filter. */
    problemTests(run) {
      return this.filteredTests(run?.tests).filter((t) => t.outcome !== 'expected' || t.note);
    },
    outcomeText(t) {
      if (t.outcome === 'unexpected') return 'failed';
      if (t.outcome === 'flaky') return 'flaky';
      if (t.outcome === 'skipped') return 'skipped';
      if (t.note?.startsWith('Known bug')) return 'known bug';
      if (t.note?.startsWith('Waiting for PO decision')) return 'PO pending';
      return 'passed';
    },
    testId(t) {
      return t.title.match(/\b(TC-[A-Z0-9-]+)\s*\|/i)?.[1] ?? '';
    },

    // ───── activity ─────
    async loadActivity() {
      this.activity = await api('GET', `/api/activity?${this.q()}&days=${this.activityDays}`);
    },
    activityPeople() {
      return [...new Set(this.activity.items.map((i) => i.who).filter(Boolean))].sort();
    },
    filteredActivity() {
      return this.activity.items.filter((i) => this.matchesFilters(i) && (!this.activityKind || i.kind === this.activityKind) && (!this.activityWho || i.who === this.activityWho));
    },
    kindLabel(kind) {
      return { run: 'Test run', studio: 'QA Studio', requirement: 'Requirement', handover: 'From developers', commit: 'Commit' }[kind] ?? kind;
    },
    kindBadge(kind) {
      return { run: 'badge-info', studio: 'badge-muted', requirement: 'badge-ok', handover: 'badge-warn', commit: 'badge-muted' }[kind] ?? 'badge-muted';
    },
    openItem(item) {
      if (item.link?.run) this.go('reports', item.link.run);
      else if (item.link?.job) this.go('logs', item.link.job);
      else if (item.link?.page) this.go(item.link.page);
    },

    // ───── logs ─────
    async loadJobs() {
      this.jobs = await api('GET', `/api/jobs?${this.q()}`);
    },
    async openJob(id) {
      this.logTab = 'commands';
      try {
        this.selectedJob = await api('GET', `/api/jobs/${id}`);
      } catch {
        this.selectedJob = { ...this.jobs.find((j) => j.id === id), lines: ['(the output of this job was not kept)'] };
      }
    },
    async openLogRun() {
      this.logRunDetail = this.logRun ? await api('GET', `/api/reports/${this.app}/${this.logRun}`) : null;
    },
    logTests() {
      return this.logOutcome === 'problems' ? this.problemTests(this.logRunDetail) : this.filteredTests(this.logRunDetail?.tests);
    },
  }));
});
