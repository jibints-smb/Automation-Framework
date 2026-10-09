// Shared by QA Studio (app.js) and QA Viewer (viewer.js): API calls, formatting and the status badges,
// so both screens show the same data the same way.

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

const FILTERS_KEY = 'qa-filters';
/** The sprint / platform / module filter, remembered in this browser (per page: Studio and Viewer have their own). */
function loadFilters() {
  try {
    return { sprint: '', platform: '', module: '', ...JSON.parse(localStorage.getItem(FILTERS_KEY) || '{}') };
  } catch {
    return { sprint: '', platform: '', module: '' };
  }
}

/** Component methods both pages use (spread into each Alpine component). */
const shared = {
  fmtDate,
  fmtDuration,

  // ───── app / sprint / platform / module filter: one bar on every data page, kept between pages ─────
  // Items carry `sprints` (or `sprint`), `platform` or `platforms`, `module` or `modules` (studio/areas.mjs).
  filters: loadFilters(),
  saveFilters() {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(this.filters));
    } catch {
      // not remembered: fine
    }
  },
  clearFilters() {
    this.filters = { sprint: '', platform: '', module: '' };
    this.saveFilters();
  },
  filtersActive() {
    return !!(this.filters.sprint || this.filters.platform || this.filters.module);
  },
  /** What the page shows, as the things the filter looks at: only these values are offered in the bar. */
  filterItems() {
    const rows = (table) => (table === 'manual' ? (this.sprint?.manual?.rows ?? []).filter((r) => r.id) : this.sprintRows(table));
    switch (this.page) {
      case 'requirements':
        return [...(this.reqs?.requirements ?? []), ...(this.reqs?.fromDev ?? [])];
      case 'testcases':
        return this.tc?.files ?? [];
      case 'sprints':
        return ['stories', 'manual', 'differences', 'questions', 'bugs'].flatMap((t) => rows(t).map((r) => this.sprintRowArea(t, r)));
      case 'reports':
        return this.reports?.runs ?? [];
      case 'activity':
        return this.activity?.items ?? [];
      case 'logs':
        return [...(this.jobs ?? []), ...(this.reports?.runs ?? [])];
      case 'jobs':
        return this.jobs ?? [];
      default:
        return [];
    }
  },
  /**
   * Values to choose from, one field after the other: sprints that have data on this page, then the platforms of
   * that sprint, then the modules of that sprint and platform. A value chosen on another page stays listed.
   */
  filterOptions() {
    const items = this.filterItems();
    const uniq = (values) => [...new Set(values.filter(Boolean))].sort();
    const { sprint, platform, module } = this.filters;
    const ignoreSprint = this.page === 'sprints';
    const inSprint = items.filter((i) => this.matchesFilters(i, { ignoreSprint, only: ['sprint'] }));
    const inPlatform = inSprint.filter((i) => this.matchesFilters(i, { ignoreSprint, only: ['platform'] }));
    const keep = (list, value) => uniq([...list, value !== 'none' ? value : '']);
    return {
      sprints: keep(items.flatMap((i) => i.sprints ?? (i.sprint ? [i.sprint] : [])), sprint),
      platforms: keep(inSprint.flatMap((i) => i.platforms ?? [i.platform]), platform),
      modules: keep(inPlatform.flatMap((i) => i.modules ?? [i.module]), module),
    };
  },
  /** A field changed: later fields whose value has nothing left under it go back to "All". */
  onFilterChange(field) {
    const order = ['sprint', 'platform', 'module'];
    for (const next of order.slice(order.indexOf(field) + 1)) {
      if (!this.filters[next]) continue;
      const items = this.filterItems().filter((i) => this.matchesFilters(i, { ignoreSprint: this.page === 'sprints', only: order.slice(0, order.indexOf(next)) }));
      const values = items.flatMap((i) => (next === 'platform' ? (i.platforms ?? [i.platform]) : (i.modules ?? [i.module])));
      if (!values.includes(this.filters[next])) this.filters[next] = '';
    }
    this.saveFilters();
  },
  /**
   * Does an item pass the filter? Sprint "none": in no sprint yet. `ignoreSprint` on the Sprints page (it picks its
   * sprint itself); `anyModule` for things that aren't about one module (a build).
   */
  matchesFilters(item, { ignoreSprint = false, anyModule = false, only } = {}) {
    // `only`: check just these fields (the bar's lists: platforms of the chosen sprint, …)
    const pick = (f) => (!only || only.includes(f) ? this.filters[f] : '');
    const [sprint, platform, module] = [pick('sprint'), pick('platform'), pick('module')];
    const sprints = item.sprints ?? (item.sprint ? [item.sprint] : []);
    const platforms = item.platforms ?? (item.platform ? [item.platform] : []);
    const modules = item.modules ?? (item.module ? [item.module] : []);
    const sprintOk = ignoreSprint || !sprint || (sprint === 'none' ? !sprints.length : sprints.includes(sprint));
    return sprintOk && (!platform || platforms.includes(platform)) && (anyModule || !module || modules.includes(module));
  },
  /** Platform and module of a test case (by ID) or a story (by Jira key), from the loaded test cases / requirements. */
  caseArea(id) {
    const file = (this.tc?.files ?? []).find((f) => f.cases.some((c) => c.id === id));
    return file ? { platform: file.platform, module: file.module, sprints: file.sprints } : {};
  },
  storyArea(text) {
    const jira = String(text ?? '').match(/[A-Z][A-Z0-9]+-\d+/)?.[0];
    const req = jira && (this.reqs?.requirements ?? []).find((r) => r.jira === jira);
    return req ? { platform: req.platform, module: req.module, sprints: req.sprints } : {};
  },
  /** Rows of a sprint-tracker table that pass the platform / module filter (the page's own sprint picker chooses the sprint). */
  filteredSprintRows(table) {
    const rows = table === 'manual' ? (this.sprint?.manual?.rows ?? []).filter((r) => r.id) : this.sprintRows(table);
    if (table === 'builds') {
      // free-text Platform column ("web / android"): mobile = android or ios
      const words = { mobile: /mobile|android|ios/i }[this.filters.platform] ?? new RegExp(this.filters.platform, 'i');
      return rows.filter((r) => !this.filters.platform || !r.platform || words.test(r.platform));
    }
    return rows.filter((r) => this.matchesFilters(this.sprintRowArea(table, r), { ignoreSprint: true }));
  },
  /** Platform / module of a sprint-tracker row: its story (Jira key), its requirement file or its test case. */
  sprintRowArea(table, row) {
    if (table === 'stories') {
      // the folder (requirements/<web|mobile|api>/), like every other page; the Platform column is free text ("android")
      const file = row['requirement file'] || row['test-cases file'] || '';
      return { platform: (file.includes('/') && file.split('/')[1]) || row.platform?.trim() || '', module: file.split('/').pop().replace(/\.testcases\.md$|\.md$/, '').replace(/^[A-Z][A-Z0-9]+-\d+-/, '') };
    }
    if (table === 'manual') return this.caseArea(row.id);
    if (table === 'bugs') return this.storyArea(row.story || row['jira bug']);
    return this.storyArea(row.jira);
  },
  /** Tests of a run (each with platform / module) that pass the filter. */
  filteredTests(tests) {
    return (tests ?? []).filter((t) => this.matchesFilters(t, { ignoreSprint: true }));
  },
  /** The count line of the filter bar, for the page shown. */
  filterSummary() {
    const of = (shown, all, what) => `Showing ${shown} of ${all} ${what}`;
    switch (this.page) {
      case 'testcases':
        return `${of(this.filteredFiles().length, this.tc?.files?.length ?? 0, 'test-case files')} (${this.coverage().total} test cases)`;
      case 'requirements':
        return `${of(this.filteredReqs().length, this.reqs?.requirements?.length ?? 0, 'requirements')}, ${this.filteredDevNotes().length} of ${this.reqs?.fromDev?.length ?? 0} developer MDs`;
      case 'sprints':
        return of(this.filteredSprintRows('stories').length, this.sprintRows('stories').length, 'stories');
      case 'reports':
        return of(this.filteredRuns().length, this.reports?.runs?.length ?? 0, 'runs');
      case 'activity':
        return of(this.filteredActivity().length, this.activity?.items?.length ?? 0, 'events');
      case 'logs':
      case 'jobs':
        return of(this.filteredJobs().length, this.jobs?.length ?? 0, 'commands');
      default:
        return '';
    }
  },
  filteredJobs() {
    return (this.jobs ?? []).filter((j) => this.matchesFilters(j));
  },
  filteredReqs() {
    return (this.reqs?.requirements ?? []).filter((r) => this.matchesFilters(r));
  },
  filteredDevNotes() {
    return (this.reqs?.fromDev ?? []).filter((d) => this.matchesFilters(d));
  },
  filteredFiles() {
    return (this.tc?.files ?? []).filter((f) => this.matchesFilters(f));
  },
  /** Coverage numbers of the filtered test-cases files (same rules as the server's). */
  coverage() {
    const all = this.filteredFiles().flatMap((f) => f.cases).filter((c) => c.automate !== 'retired');
    return {
      total: all.length,
      automated: all.filter((c) => c.hasTest).length,
      missing: all.filter((c) => c.automate === 'yes' && !c.hasTest).length,
      later: all.filter((c) => c.automate === 'later').length,
      manualOnly: all.filter((c) => c.automate === 'no').length,
      covered: all.filter((c) => c.hasTest || c.manual).length,
    };
  },

  // ───── test-case drawer (Test cases page): the whole test case, opened from its row ─────
  viewerMode: false, // QA Viewer sets true: its drawer shows the commands to type
  drawer: null, // { file, c }
  openCase(file, c) {
    this.drawer = { file, c };
    this.$nextTick(() => document.getElementById('case-drawer-body')?.scrollTo(0, 0));
  },
  closeCase() {
    this.drawer = null;
  },
  /** The cases the table shows (filters applied), for Previous / Next in the drawer. */
  drawerList() {
    return this.filteredFiles().flatMap((file) => this.filteredCases(file).map((c) => ({ file, c })));
  },
  drawerPosition() {
    const list = this.drawerList();
    return { index: list.findIndex((x) => x.c.id === this.drawer?.c.id), total: list.length };
  },
  moveCase(step) {
    const list = this.drawerList();
    const next = list[this.drawerPosition().index + step];
    if (next) this.openCase(next.file, next.c);
  },
  /** Test-case text as HTML: escaped, with `code` kept as code. */
  caseHtml(text) {
    return String(text ?? '')
      .replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
      .replace(/`([^`]+)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-brand-900">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  },
  /** An expected result often lists several checks separated by ";": one line each, each starting upper case. */
  expectedLines(text) {
    return String(text ?? '')
      .split(/;\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
  },
  typeBadge(type) {
    return { negative: 'badge-warn', security: 'badge-bad', positive: 'badge-ok' }[type] ?? 'badge-info';
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
  reqBadge(status) {
    return { changed: 'badge-warn', 'needs test cases': 'badge-info', 'baseline missing': 'badge-warn', 'up to date': 'badge-ok' }[status] ?? 'badge-muted';
  },
  resultBadge(result) {
    if (!result) return 'badge-muted';
    if (/^(passed|pass|manual pass)/.test(result)) return 'badge-ok';
    if (/^(failed|fail|manual fail)/.test(result)) return 'badge-bad';
    return 'badge-warn';
  },
  jobBadge(status) {
    return { passed: 'badge-ok', failed: 'badge-bad', stopped: 'badge-warn', running: 'badge-info' }[status] ?? 'badge-muted';
  },
  toast(message, kind = 'ok') {
    const id = Math.random();
    this.toasts.push({ id, message, kind });
    setTimeout(() => (this.toasts = this.toasts.filter((t) => t.id !== id)), kind === 'bad' ? 7000 : 3500);
  },
};
