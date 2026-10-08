# Advertiser Accounts: automation handoff

| Item            | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Jira key        | _fill in_                                                                   |
| Feature         | User management: advertisers                                                |
| Page            | Advertiser Accounts: `/advertisers` (tab title "Advertiser Accounts")         |
| Components      | `src/app/(dashboard)/advertisers/page.tsx`, shared: `UserRowActions` (with `approvable`), `ExportUsersButton`, `SearchBox`, `FilterSelect` (incl. searchable), `ClearFilters`, `Pager`, `ConfirmDialog`, Toast |
| QA files        | `pages/advertisers/AdvertisersLocators.js`, `AdvertisersPage.js`, `tests/advertisers/advertisers.spec.js` |
| Shared objects  | `Toast`, `ConfirmDialog` ([README §5](README.md#5-shared-components))        |
| Contract date   | _fill in with the build date_                                               |

Advertisers are businesses that sign up to place ads. A new advertiser starts as **Pending**, and an admin must
**approve** them. The admin can also block, unblock and delete advertisers, and filter and export the list. **The
admin cannot create or edit an advertiser here.**

---

## 1. Flow

```
Signed-in admin → sidebar "Advertiser Accounts" (badge = pending count) → /advertisers
  ↓
Page shows: 4 stat tiles · "All advertiser accounts" + "{n} total" · toolbar · table (10 per page) · pager
  ↓
┌─ Find an advertiser ─────────────────────────────────────────────────────────────┐
│  Search (company name / email / phone) → ?q=…                                     │
│  Status (All statuses / Approved / Pending / Blocked) → ?status=approved|pending|blocked │
│  Advertiser picker (searchable, approved advertisers only) → ?adv=<id>            │
│  Clear → removes q, status, adv · Pager → ?page=N                                 │
└───────────────────────────────────────────────────────────────────────────────────┘
  ↓ (on the row) the status decides the actions:
┌──────────────┬────────────────────┬─────────────────────────────────────────────┐
│ Status pill  │ Actions            │ After the action                            │
├──────────────┼────────────────────┼─────────────────────────────────────────────┤
│ Pending      │ Approve, Delete    │ Approve → confirm → "Approved"              │
│ Approved     │ Block, Delete      │ Block → confirm → "Blocked"                 │
│ Blocked      │ Unblock, Delete    │ Unblock → confirm → "Approved" or "Pending" │
└──────────────┴────────────────────┴─────────────────────────────────────────────┘
  Delete (any status) → confirm → row removed
  ↓
Export → .xlsx of the filtered list (all pages) → toast "Advertisers exported"
```

Full lifecycle: `Sign-up → Pending → (Approve) → Approved ⇄ (Block / Unblock) ⇄ Blocked → (Delete) → gone`.
A **Pending** advertiser that is blocked becomes Pending again when unblocked. It still needs approval.

## 2. Function mapping

| Flow step             | App function / action                                                       | Page Object method                   | Expected result                              |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------- |
| Open page             | `getUserList({ role: "Advertiser" })`, `getUserCounts`, `getApprovalCounts`, `getAdvertiserOptions` | `open()` | Heading "Advertiser Accounts"; table rendered |
| Search                | `SearchBox` → `q`                                                           | `search(term)`                       | URL `q=`; rows match                         |
| Filter by status      | `FilterSelect paramKey="status"`                                            | `filterByStatus(label)`              | URL `status=approved\|pending\|blocked`      |
| Pick an advertiser    | `FilterSelect paramKey="adv" searchable`                                    | `filterByAdvertiser(companyName)`    | URL `adv=<id>`; one advertiser shown         |
| Clear                 | `ClearFilters keys={["q","status","adv"]}`                                  | `clearFilters()`                     | All three removed                            |
| Read a row            | —                                                                           | `readRow(email)`                     | `{ company, location, website, contact, email, phone, joined, status }` |
| Approve               | `approveUserAction(uid, "/advertisers")`                                    | `approve(email)`                     | Toast "{contact name} approved"; pill "Approved" |
| Block                 | `setUserActiveAction(uid, false, …)`                                        | `block(email)`                       | Toast "{contact name} blocked"; pill "Blocked" |
| Unblock               | `setUserActiveAction(uid, true, …)`                                         | `unblock(email)`                     | Toast "{contact name} unblocked"; pill shows the approval state again |
| Delete                | `deleteUserAction(uid, …)`                                                  | `delete(email)`                      | Toast "{contact name} deleted"; row gone     |
| Export                | `exportUsersAction({ role: "Advertiser", search, status, userId })`         | `export()`                           | `.xlsx`; toast "Advertisers exported"        |

## 3. Preconditions

1. Signed in as admin (`storageState` from auth setup, [BK-1](BK-1-login.md)).
2. **Seeded test advertisers on QA**, each with a unique email:
   - `QA_ADV_PENDING_EMAIL`: a pending advertiser for the approve test. Once approved it stays approved, so it must be
     **re-seeded** before each approve run.
   - `QA_ADV_APPROVED_EMAIL`: an approved advertiser for block → unblock (put back after the test). It needs a known
     company name (`QA_ADV_APPROVED_COMPANY`) for the picker test.
   - `QA_ADV_DELETE_EMAIL`: a disposable advertiser for delete. **Delete is permanent.** Re-seed it before each run.
   - At least one advertiser **with** a website and one **without**.
3. Advertisers sign up through the website or app. The admin panel cannot create them.
4. Blocking or deleting an advertiser also affects their **ads** (hidden, ended, or rejected and refunded). Use
   advertisers that have no ads other teams depend on.

## 4. Test data

| Data                          | Source                                         | Type                 |
| ----------------------------- | ---------------------------------------------- | -------------------- |
| Pending advertiser email      | `QA_ADV_PENDING_EMAIL` (re-seeded per run)     | Seeded per run       |
| Approved advertiser email     | `QA_ADV_APPROVED_EMAIL`                        | Environment-specific |
| Approved advertiser company   | `QA_ADV_APPROVED_COMPANY`                      | Environment-specific |
| Disposable advertiser email   | `QA_ADV_DELETE_EMAIL` (re-seeded per run)      | Seeded per run       |
| No-match search term          | `zz-no-match-${Date.now()}`                    | Generated            |
| Anything else                 | Read from the page. **Do not hard-code** counts, names or dates | Dynamic |

## 5. Locator inventory (the contract)

### Page and stats
| Element               | Role    | Accessible name          | Locator                                                          | Test ID                         | Dynamic |
| --------------------- | ------- | ------------------------ | ---------------------------------------------------------------- | ------------------------------- | ------- |
| Page heading (topbar) | heading | Advertiser Accounts      | `getByRole('heading', { name: 'Advertiser Accounts', level: 1 })` | none                           | No      |
| Panel heading         | heading | All advertiser accounts  | `getByRole('heading', { name: 'All advertiser accounts' })`      | none                            | No      |
| Total count pill      | —       | "{n} total"              | `getByText(/^\d+ total$/)`                                       | none                            | Yes     |
| Stat: Total           | —       | —                        | `getByTestId('advertisers-stat-total')`                          | `advertisers-stat-total` ⚠      | Yes     |
| Stat: Approved        | —       | —                        | `getByTestId('advertisers-stat-approved')`                       | `advertisers-stat-approved` ⚠   | Yes     |
| Stat: Pending         | —       | —                        | `getByTestId('advertisers-stat-pending')`                        | `advertisers-stat-pending` ⚠    | Yes     |
| Stat: Total revenue   | —       | —                        | `getByTestId('advertisers-stat-revenue')`                        | `advertisers-stat-revenue` ⚠    | No (always $0) |

### Toolbar
| Element               | Role      | Accessible name                              | Locator                                                                        | Test ID | Dynamic |
| --------------------- | --------- | -------------------------------------------- | ------------------------------------------------------------------------------ | ------- | ------- |
| Search                | searchbox | Search by company name, email or phone…      | `getByRole('searchbox', { name: 'Search by company name, email or phone…' })`  | none    | No      |
| Status filter         | combobox  | All statuses (always)                        | `getByRole('combobox', { name: 'All statuses' })`                              | none    | No      |
| Status option         | option    | All statuses / Approved / Pending / Blocked  | `page.getByRole('option', { name, exact: true })`                              | none    | No      |
| Advertiser picker     | combobox  | All advertisers (always)                     | `getByRole('combobox', { name: 'All advertisers' })`                           | none    | No      |
| Picker search box     | textbox   | Search advertisers…                          | `page.getByRole('textbox', { name: 'Search advertisers…' })`                   | none    | No      |
| Picker option         | option    | company name (or contact name)               | `page.getByRole('option', { name, exact: true })`                              | none    | Yes     |
| Picker "no matches"   | —         | No matches                                   | `page.getByText('No matches')`                                                 | none    | No      |
| Clear                 | button    | Clear                                        | `getByRole('button', { name: 'Clear', exact: true })`                          | none    | No      |
| Export                | button    | Export / Exporting…                          | `getByRole('button', { name: /^(Export\|Exporting…)$/ })`                      | none    | Yes     |

### Table (repeated — one per advertiser)
| Element              | Role   | Accessible name    | Locator (inside `row`)                                         | Test ID                        | Dynamic |
| -------------------- | ------ | ------------------ | -------------------------------------------------------------- | ------------------------------ | ------- |
| Row                  | row    | —                  | `getByTestId('advertiser-row').filter({ hasText: email })`     | `advertiser-row` ⚠             | Yes     |
| Company name         | —      | —                  | `getByTestId('advertiser-company')`                            | `advertiser-company` ⚠         | Yes ¹   |
| Location             | —      | "address, town" or "—" | `getByTestId('advertiser-location')`                       | `advertiser-location` ⚠        | Yes     |
| Website link         | link   | Website link       | `getByRole('link', { name: 'Website link' })`                  | none                           | Yes ²   |
| No website pill      | —      | No website         | `getByText('No website', { exact: true })`                     | none                           | Yes     |
| Contact person       | —      | —                  | `getByTestId('advertiser-contact-name')`                       | `advertiser-contact-name` ⚠    | Yes     |
| Email                | —      | —                  | `getByTestId('advertiser-email')`                              | `advertiser-email` ⚠           | Yes     |
| Email verified icon  | img    | Email verified     | `getByRole('img', { name: 'Email verified' })`                 | none (a11y fix ⚠)              | Yes     |
| Phone                | —      | —                  | `getByTestId('advertiser-phone')`                              | `advertiser-phone` ⚠           | Yes     |
| Phone verified icon  | img    | Phone verified     | `getByRole('img', { name: 'Phone verified' })`                 | none (a11y fix ⚠)              | Yes     |
| Joined               | —      | "Sep 22, 2026"     | `getByTestId('advertiser-joined')`                             | `advertiser-joined` ⚠          | Yes     |
| Status pill          | —      | Pending / Approved / Blocked | `getByTestId('advertiser-status')`                   | `advertiser-status` ⚠          | Yes     |
| Approve              | button | Approve            | `getByRole('button', { name: 'Approve', exact: true })`        | none                           | Pending only |
| Block                | button | Block              | `getByRole('button', { name: 'Block', exact: true })`          | none                           | Approved only |
| Unblock              | button | Unblock            | `getByRole('button', { name: 'Unblock', exact: true })`        | none                           | Blocked only |
| Delete               | button | Delete             | `getByRole('button', { name: 'Delete', exact: true })`         | none                           | No      |
| Empty state          | —      | No advertiser accounts found. / No advertisers found | `getByTestId('table-empty')`   | `table-empty` ⚠                | Yes     |

¹ Shows the company name. If it is blank, it shows the contact person's name instead.
² The link opens in a **new tab**. Its `href` is the website, with `https://` added if it has no scheme. Its `title`
  attribute shows the raw website value.

### Confirm dialogs (shared `ConfirmDialog`)
| Action  | Dialog name (title)        | Confirm button      | Button colour | Message contains                                               |
| ------- | -------------------------- | ------------------- | ------------- | -------------------------------------------------------------- |
| Approve | Approve this advertiser?   | Approve             | green         | "{name} will be approved and can start using their account. They'll be notified by email." |
| Block   | Block this account?        | Block account       | red           | "…revoke the advertiser's access to the website and mobile app. Any live advertisements … will also be hidden…" |
| Unblock | Unblock this account?      | Unblock account     | green         | "…restore the advertiser's access… hidden … displayed again…" |
| Delete  | Delete advertiser?         | Delete permanently  | red           | "…permanently remove the account… pending advertisement requests will be automatically rejected & refunded…" |

`{name}` and the toast names are the **contact person's name**, not the company name.

⚠ Pending developer change ([README §7](README.md#7-pending-developer-changes-all-pages)). Temporary row locator:
`page.getByRole('row').filter({ hasText: email })`.

## 6. Locator file

```js
// pages/advertisers/AdvertisersLocators.js
const AdvertisersLocators = {
  // page
  pageHeading: (page) => page.getByRole('heading', { name: 'Advertiser Accounts', level: 1 }),
  panelHeading: (page) => page.getByRole('heading', { name: 'All advertiser accounts' }),
  totalCount: (page) => page.getByText(/^\d+ total$/),
  statTotal: (page) => page.getByTestId('advertisers-stat-total'),
  statApproved: (page) => page.getByTestId('advertisers-stat-approved'),
  statPending: (page) => page.getByTestId('advertisers-stat-pending'),
  statRevenue: (page) => page.getByTestId('advertisers-stat-revenue'),

  // toolbar
  searchInput: (page) => page.getByRole('searchbox', { name: 'Search by company name, email or phone…' }),
  statusFilter: (page) => page.getByRole('combobox', { name: 'All statuses' }),
  advertiserPicker: (page) => page.getByRole('combobox', { name: 'All advertisers' }),
  advertiserPickerSearch: (page) => page.getByRole('textbox', { name: 'Search advertisers…' }),
  option: (page, label) => page.getByRole('option', { name: label, exact: true }),
  clearButton: (page) => page.getByRole('button', { name: 'Clear', exact: true }),
  exportButton: (page) => page.getByRole('button', { name: /^(Export|Exporting…)$/ }),

  // table
  rows: (page) => page.getByTestId('advertiser-row'),
  rowByText: (page, text) => page.getByTestId('advertiser-row').filter({ hasText: text }),
  // rowByText: (page, text) => page.getByRole('row').filter({ hasText: text }),   // temporary
  emptyState: (page) => page.getByTestId('table-empty'),
  allStatuses: (page) => page.getByTestId('advertiser-status'),

  // inside a row
  company: (row) => row.getByTestId('advertiser-company'),
  location: (row) => row.getByTestId('advertiser-location'),
  websiteLink: (row) => row.getByRole('link', { name: 'Website link' }),
  noWebsite: (row) => row.getByText('No website', { exact: true }),
  contactName: (row) => row.getByTestId('advertiser-contact-name'),
  email: (row) => row.getByTestId('advertiser-email'),
  phone: (row) => row.getByTestId('advertiser-phone'),
  joined: (row) => row.getByTestId('advertiser-joined'),
  status: (row) => row.getByTestId('advertiser-status'),
  emailVerified: (row) => row.getByRole('img', { name: 'Email verified' }),
  phoneVerified: (row) => row.getByRole('img', { name: 'Phone verified' }),
  approveButton: (row) => row.getByRole('button', { name: 'Approve', exact: true }),
  blockButton: (row) => row.getByRole('button', { name: 'Block', exact: true }),
  unblockButton: (row) => row.getByRole('button', { name: 'Unblock', exact: true }),
  deleteButton: (row) => row.getByRole('button', { name: 'Delete', exact: true }),

  // pager
  pager: (page) => page.getByRole('navigation', { name: 'Pagination' }),
  pageLink: (page, n) => page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: `Page ${n}`, exact: true }),
};

const AdvertisersDialogs = {
  approve: { title: 'Approve this advertiser?', confirm: 'Approve' },
  block: { title: 'Block this account?', confirm: 'Block account' },
  unblock: { title: 'Unblock this account?', confirm: 'Unblock account' },
  delete: { title: 'Delete advertiser?', confirm: 'Delete permanently' },
};

const STATUS_URL = { Approved: 'approved', Pending: 'pending', Blocked: 'blocked' };

module.exports = { AdvertisersLocators, AdvertisersDialogs, STATUS_URL };
```

## 7. Page Object

```js
// pages/advertisers/AdvertisersPage.js
const { expect } = require('@playwright/test');
const { AdvertisersLocators: L, AdvertisersDialogs: D, STATUS_URL } = require('./AdvertisersLocators');
const { ConfirmDialog } = require('../components/ConfirmDialog');
const { Toast } = require('../components/Toast');

class AdvertisersPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.toast = new Toast(page);

    this.pageHeading = L.pageHeading(page);
    this.searchInput = L.searchInput(page);
    this.statusFilter = L.statusFilter(page);
    this.advertiserPicker = L.advertiserPicker(page);
    this.clearButton = L.clearButton(page);
    this.exportButton = L.exportButton(page);
    this.rows = L.rows(page);
    this.emptyState = L.emptyState(page);
  }

  async open(query = '') {
    await this.page.goto(`/advertisers${query}`);
    await expect(this.pageHeading).toBeVisible();
  }

  // ── find (each retries the interaction to cover the hydration window) ──
  async search(term) {
    await expect(async () => {
      await this.searchInput.fill(term);
      await this.searchInput.press('Enter');
      await expect(this.page).toHaveURL(/[?&]q=/, { timeout: 2_000 });
    }).toPass();
  }

  /** label: 'Approved' | 'Pending' | 'Blocked' | 'All statuses' */
  async filterByStatus(label) {
    const expected = STATUS_URL[label] ? new RegExp(`status=${STATUS_URL[label]}`) : /^(?!.*status=)/;
    await expect(async () => {
      await this.statusFilter.click();
      await L.option(this.page, label).click({ timeout: 2_000 });
      await expect(this.page).toHaveURL(expected, { timeout: 2_000 });
    }).toPass();
  }

  /** Picks by the label shown in the list (company name, or contact name if there is no company). */
  async filterByAdvertiser(label) {
    await expect(async () => {
      await this.advertiserPicker.click();
      await L.advertiserPickerSearch(this.page).fill(label, { timeout: 2_000 });
      await L.option(this.page, label).click({ timeout: 2_000 });
      await expect(this.page).toHaveURL(/[?&]adv=\d+/, { timeout: 2_000 });
    }).toPass();
  }

  async clearFilters() {
    await this.clearButton.click();
    await expect(this.clearButton).toBeDisabled();
  }

  // ── rows ──────────────────────────────────────────────────────────────
  row(text) { return L.rowByText(this.page, text); }

  async readRow(text) {
    const row = this.row(text);
    const hasWebsite = (await L.websiteLink(row).count()) > 0;
    return {
      company: (await L.company(row).innerText()).trim(),
      location: (await L.location(row).innerText()).trim(),
      website: hasWebsite ? await L.websiteLink(row).getAttribute('href') : null,
      contact: (await L.contactName(row).innerText()).trim(),
      email: (await L.email(row).innerText()).trim(),
      phone: (await L.phone(row).innerText()).trim(),
      joined: (await L.joined(row).innerText()).trim(),
      status: (await L.status(row).innerText()).trim(),
    };
  }

  async allStatuses() { return (await L.allStatuses(this.page).allInnerTexts()).map((s) => s.trim()); }

  async expectStatus(text, status) { await expect(L.status(this.row(text))).toHaveText(status); }

  /** Checks that the row offers exactly the actions its status allows. */
  async expectActionsFor(text, status) {
    const row = this.row(text);
    const visible = {
      Pending: ['approveButton', 'deleteButton'],
      Approved: ['blockButton', 'deleteButton'],
      Blocked: ['unblockButton', 'deleteButton'],
    }[status];
    for (const key of ['approveButton', 'blockButton', 'unblockButton', 'deleteButton']) {
      await expect(L[key](row)).toHaveCount(visible.includes(key) ? 1 : 0);
    }
  }

  // ── actions ───────────────────────────────────────────────────────────
  async #rowAction(text, buttonKey, dialog, toastSuffix) {
    const row = this.row(text);
    const name = (await L.contactName(row).innerText()).trim();
    await L[buttonKey](row).click();
    if (dialog) await new ConfirmDialog(this.page, dialog.title).confirm(dialog.confirm);
    await this.toast.expectSuccess(`${name} ${toastSuffix}`);
  }

  async approve(text) {
    await this.#rowAction(text, 'approveButton', D.approve, 'approved');
    await this.expectStatus(text, 'Approved');
  }

  async block(text) {
    await this.#rowAction(text, 'blockButton', D.block, 'blocked');
    await this.expectStatus(text, 'Blocked');
  }

  /** Returns to the approval state the advertiser had before ('Approved' or 'Pending'). */
  async unblock(text, expectedStatus = 'Approved') {
    await this.#rowAction(text, 'unblockButton', D.unblock, 'unblocked');
    await this.expectStatus(text, expectedStatus);
  }

  async delete(text) {
    await this.#rowAction(text, 'deleteButton', D.delete, 'deleted');
    await expect(this.row(text)).toHaveCount(0);
  }

  async cancel(text, action) {
    const buttonKey = `${action}Button`;
    await L[buttonKey](this.row(text)).click();
    await new ConfirmDialog(this.page, D[action].title).cancel();
  }

  async export() {
    const [download] = await Promise.all([this.page.waitForEvent('download'), this.exportButton.click()]);
    await this.toast.expectSuccess('Advertisers exported');
    return download;
  }

  async exportExpectingNothing() {
    await this.exportButton.click();
    await this.toast.expectInfo('There are no advertiser accounts available to export.');
  }
}

module.exports = { AdvertisersPage };
```

## 8. Tests (business-level only)

```js
// tests/advertisers/advertisers.spec.js
const { test, expect } = require('@playwright/test');
const { AdvertisersPage } = require('../../pages/advertisers/AdvertisersPage');

const {
  QA_ADV_PENDING_EMAIL, QA_ADV_APPROVED_EMAIL, QA_ADV_APPROVED_COMPANY, QA_ADV_DELETE_EMAIL,
} = process.env;

test.describe('Advertiser Accounts', () => {
  let advertisers;

  test.beforeEach(async ({ page }) => {
    advertisers = new AdvertisersPage(page);
    await advertisers.open();
  });

  test('Pending filter shows only pending advertisers', async () => {
    await advertisers.filterByStatus('Pending');
    for (const status of await advertisers.allStatuses()) expect(['Pending', 'Blocked']).toContain(status);
  });

  test('picking an advertiser shows only that advertiser', async () => {
    await advertisers.filterByAdvertiser(QA_ADV_APPROVED_COMPANY);
    await expect(advertisers.rows).toHaveCount(1);
    expect((await advertisers.readRow(QA_ADV_APPROVED_EMAIL)).company).toBe(QA_ADV_APPROVED_COMPANY);
  });

  test('a pending advertiser offers Approve, not Block', async () => {
    await advertisers.search(QA_ADV_PENDING_EMAIL);
    await advertisers.expectActionsFor(QA_ADV_PENDING_EMAIL, 'Pending');
  });

  test('approve a pending advertiser', async () => {
    test.skip(!QA_ADV_PENDING_EMAIL, 'needs a freshly seeded pending advertiser');
    await advertisers.search(QA_ADV_PENDING_EMAIL);
    await advertisers.approve(QA_ADV_PENDING_EMAIL);
    await advertisers.expectActionsFor(QA_ADV_PENDING_EMAIL, 'Approved');
  });

  test('block then unblock an approved advertiser', async () => {
    await advertisers.search(QA_ADV_APPROVED_EMAIL);
    await advertisers.block(QA_ADV_APPROVED_EMAIL);
    await advertisers.expectActionsFor(QA_ADV_APPROVED_EMAIL, 'Blocked');
    await advertisers.unblock(QA_ADV_APPROVED_EMAIL, 'Approved');
  });

  test('cancelling a delete keeps the advertiser', async () => {
    await advertisers.search(QA_ADV_APPROVED_EMAIL);
    await advertisers.cancel(QA_ADV_APPROVED_EMAIL, 'delete');
    await expect(advertisers.row(QA_ADV_APPROVED_EMAIL)).toHaveCount(1);
  });

  test('delete a disposable advertiser', async () => {
    test.skip(!QA_ADV_DELETE_EMAIL, 'needs a freshly seeded advertiser');
    await advertisers.search(QA_ADV_DELETE_EMAIL);
    await advertisers.delete(QA_ADV_DELETE_EMAIL);
  });

  test('export downloads an xlsx file', async () => {
    const download = await advertisers.export();
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});
```

## 9. Dependencies

| Function                | API                                                          | Purpose                     | Failure handling                           |
| ----------------------- | ------------------------------------------------------------ | --------------------------- | ------------------------------------------ |
| `getUserList`           | `GET user` with `where: { role: "Advertiser", approval_status? / active? / id? }`, `search`, `sort: created_at desc`, `limit 10` (+ town names lookup) | Table | Error → empty table, no message |
| `getUserCounts`         | `GET user` count (total)                                     | Tile "Total Advertisers"    | Error → 0                                  |
| `getApprovalCounts`     | `GET user` counts by `approval_status` Approved / Pending   | Tiles "Approved", "Pending" | Error → 0                                  |
| `getAdvertiserOptions`  | `GET user` `role: Advertiser`, `approval_status: Approved`, `limit 200`, sorted by company | Picker options | Error → empty list |
| `approveUserAction`     | `PUT user/{user_uid}/approval` `{ "status": "Approved" }`   | Approve                     | Error toast titled "Approve"               |
| `setUserActiveAction`   | `PUT user/{user_uid}/status` `{ "active": bool }`           | Block / unblock             | Error toast titled "Block" / "Unblock"     |
| `deleteUserAction`      | `DELETE user/{user_uid}`                                     | Delete                      | Error toast titled "Delete"                |
| `exportUsersAction`     | `GET user/export` `role=Advertiser`, `status=All\|Approved\|Pending\|Inactive`, plus search and `id` | Export | Toast "Export failed" |

All calls run on the Next.js server. **They do not appear in the browser's Network tab.** After any successful row
action, the page **and the sidebar badge** (pending count) are refreshed.

Downstream effects (backend, beyond this page):
- **Approve:** the advertiser is emailed and can start using their account.
- **Block:** access to the website and app is revoked, and live ads are hidden.
- **Unblock:** access is restored, hidden ads go live again, and pending ad requests can be actioned again.
- **Delete:** the account is removed, pending ad requests are rejected and refunded, and running ads are ended.

## 10. Conditional flows

```
IF status is Pending (and not blocked) → Approve + Delete
IF status is Approved                  → Block + Delete
IF the account is blocked               → pill "Blocked" (whatever the approval says) → Unblock + Delete
IF a blocked Pending advertiser is unblocked → back to Pending → Approve appears
IF Unblock is clicked                  → asks for confirmation on this page (Parent Accounts does not)
IF a confirm dialog is cancelled       → nothing changes, no toast
IF the company name is blank            → the Company column shows the contact person's name
IF there is no website                  → grey "No website" pill instead of the link
IF there is no address or town          → "—"
IF the filtered list is empty           → "No advertiser accounts found." (unfiltered and empty: "No advertisers found")
IF Export is clicked on an empty list   → info toast, no download
IF the total is ≤ 10                    → no pager
```

## 11. Expected result per step

| Step                       | Expected                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Open `/advertisers`        | Topbar "Advertiser Accounts" / "Approve, block, or remove advertising partners"; 4 tiles; up to 10 rows, newest first; Ads and Revenue columns show "—" |
| Pick status "Pending"      | URL `?status=pending`; rows have an approval status of Pending (see §15)              |
| Pick an advertiser         | URL `?adv=<id>`; one row; the picker shows the company name                           |
| Click Clear                | URL loses `q`, `status` and `adv`; Clear disabled                                     |
| Approve → confirm          | Toast "{contact} approved" → pill "Approved" → actions become Block + Delete → "Pending" tile and sidebar badge −1, "Approved" tile +1 |
| Block → confirm            | Toast "{contact} blocked" → pill "Blocked" → actions become Unblock + Delete          |
| Unblock → confirm          | Toast "{contact} unblocked" → pill back to "Approved" (or "Pending")                  |
| Delete → confirm           | Toast "{contact} deleted" → row gone → "{n} total" −1                                 |
| Website link               | Opens the site in a new tab (`target="_blank"`)                                       |
| Export                     | "Exporting…" → `.xlsx` download (fallback name `advertisers.xlsx`) → toast "Advertisers exported" |

## 12. Failure scenarios

| Scenario                              | Expected behaviour                                                |
| ------------------------------------- | ----------------------------------------------------------------- |
| List API fails                        | Empty-state row. **No error message**                            |
| Approve fails                         | Error toast titled "Approve" with the API message; pill unchanged |
| Block / unblock fails                 | Error toast titled "Block" / "Unblock"; pill unchanged             |
| Delete fails                          | Error toast titled "Delete"; row stays                             |
| Row is missing its uid                | Error toast "This account is missing its identifier — reload and try again." |
| Picker search matches nothing         | "No matches" inside the dropdown                                   |
| Export fails                          | Toast "Export failed" + message; no download                       |
| Export on an empty list               | Info toast "There are no advertiser accounts available to export." |
| Session expired                       | Next navigation → `/auth/login?callbackUrl=/advertisers`           |

## 13. Navigation

```
Sidebar "Advertiser Accounts" (pending badge) / command menu → /advertisers
/advertisers?q=&status=&adv=&page=     (all state in the URL)
Website link → external site, new tab
Confirm dialogs → stay on /advertisers
Session expired → /auth/login?callbackUrl=/advertisers
```

## 14. Environment

| Item           | Value                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| Supported      | QA (seeded advertisers). **Production: not for automation**: real businesses, real ads, refunds |
| Required env   | `BASE_URL`, auth `storageState`, `QA_ADV_PENDING_EMAIL`, `QA_ADV_APPROVED_EMAIL`, `QA_ADV_APPROVED_COMPANY`, `QA_ADV_DELETE_EMAIL` |
| Feature flags  | None                                                                               |
| Parallel runs  | Approve, block/unblock and delete change shared data and the sidebar badge. Run them **serially** |

## 15. Known limitations and gotchas

- **The status filter reads one field, but the pill combines two.** "Approved" and "Pending" filter on the approval
  status only. A **blocked** advertiser whose approval is Approved shows under the *Approved* filter with a
  **Blocked** pill. Tests on filters must allow `Blocked` pills in the Approved/Pending results, or check the approval
  state differently. The "Blocked" filter returns every deactivated account.
- **The tiles do the same.** "Approved" and "Pending" count by approval status and include blocked accounts. The tiles
  ignore the toolbar filters.
- **The advertiser picker lists only approved advertisers** (up to 200). Pending advertisers cannot be picked: use
  search instead. Its options are labelled by **company name**, while toasts use the **contact name**.
- **"Total revenue" is always $0, and Ads and Revenue are always "—".** The backend has no ad or payment totals yet.
  Do not automate them as features.
- **Unblock confirms here but not on Parent Accounts.** Do not share one "unblock" helper between the two pages
  without taking that into account.
- The **Approve** row button and the dialog's **Approve** confirm button have the same name. Always scope the confirm
  button to the dialog (the `ConfirmDialog` object does this).
- Status options and picker options open in portals. Find them from `page`.
- Hydration window: see [README §5.5](README.md#55-known-behaviour-that-affects-all-list-tests).

## 16. Handoff entries

```
Feature: User management   Page: Advertiser Accounts   Component: Toolbar
Element: Search            Role: searchbox  Name: Search by company name, email or phone…  Test ID: —  Notes: ?q=
Element: Status filter     Role: combobox   Name: All statuses        Test ID: —  Notes: approved|pending|blocked
Element: Advertiser picker Role: combobox   Name: All advertisers     Test ID: —  Notes: approved only; ?adv=<id>
Element: Picker search     Role: textbox    Name: Search advertisers… Test ID: —  Notes: inside dropdown (portal)
Element: Clear / Export    Role: button     Name: Clear / Export      Test ID: —

Component: Advertisers table
Element: Row               Role: row     Name: —              Test ID: advertiser-row       Dynamic: Yes  Notes: filter by email; pending
Element: Status            Role: —       Name: —              Test ID: advertiser-status    Dynamic: Yes  Notes: Pending/Approved/Blocked; pending
Element: Website           Role: link    Name: Website link   Test ID: —                    Dynamic: Yes  Notes: new tab; or "No website"
Element: Approve           Role: button  Name: Approve        Test ID: —                    Dynamic: Yes  Notes: Pending only; confirms (green)
Element: Block             Role: button  Name: Block          Test ID: —                    Dynamic: Yes  Notes: Approved only; confirms
Element: Unblock           Role: button  Name: Unblock        Test ID: —                    Dynamic: Yes  Notes: Blocked only; confirms
Element: Delete            Role: button  Name: Delete         Test ID: —                    Dynamic: No   Notes: confirms; permanent; ads ended/refunded
```

## 17. Readiness

| Check                                          | Status                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| Semantic HTML (`<table>`, `<nav>`, `role=search`, `alertdialog`) | ✅                                       |
| Every control has an accessible name           | ✅                                                         |
| Verified icons have an accessible name         | ❌ Fix: `role="img"` + `aria-label`                        |
| Row and cell identification                    | ⚠ needs `advertiser-row` and cell test ids                |
| Test data strategy                             | ⚠ seeded pending and disposable advertisers needed per run |
| Handoff documented                             | ✅ this file                                               |

### Change log
| Date | Element | Old | New | QA notified |
| ---- | ------- | --- | --- | ----------- |
| —    |         |     |     |             |
