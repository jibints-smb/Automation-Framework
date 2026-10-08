/**
 * Story:      BK-7 — Advertiser Accounts      (requirements/web/BK-7-advertiser-accounts.md)
 * Test cases: test-cases/web/advertiser-accounts.testcases.md
 *
 * Expected results follow QA's BK-7 specification. Where the staging build differs (D17–D19 in sprints/sprint-01.md),
 * the test waits for the PO: pendingDecision().
 * Data: advertisers can't be created here, so tests read the advertisers that exist; tests that need a status nobody
 * has (pending, blocked) skip with the reason. Block / unblock use a seeded QA advertiser (QA_ADV_APPROVED_EMAIL).
 * Not automated: TC-ADV-03/04/05/12/18/24/25 (later), TC-ADV-21/26 (manual: the advertiser's website / app sessions).
 */
import { test } from '@apps/bergen-kids-admin-web/fixtures';
import { needsSeededAdvertiser, noMatchTerm, partOf, seededApprovedAdvertiser } from '@apps/bergen-kids-admin-web/data/web/advertiser-accounts.data';
import { AdvertiserMessages, StatusOptions, rowAt, rowOf } from '@apps/bergen-kids-admin-web/models/web/advertiser-accounts.model';
import { pendingDecision, storyInfo } from '@core/utils/allure';

test.beforeEach(async () => {
  await storyInfo({
    epic: 'User management',
    feature: 'Advertiser Accounts',
    story: 'BK-7 Advertiser Accounts',
    jira: 'BK-7',
    severity: 'normal',
  });
});

test.describe('Advertiser Accounts: summary and listing', () => {
  test.beforeEach(async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.open();
    await advertiserAccountsPage.expectLoaded();
  });

  test('TC-ADV-01 | Summary cards show Total, Approved, Pending and Total revenue', { tag: ['@regression', '@TC-ADV-01'] }, async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.expectSummaryCards();
  });

  test('TC-ADV-02 | Pending badge shows the exact count up to 10', { tag: ['@regression', '@TC-ADV-02'] }, async ({ advertiserAccountsPage }) => {
    const pending = await advertiserAccountsPage.pendingCount();
    test.skip(pending === 0, 'No advertiser waits for approval on this environment, so there is no badge to check');
    test.skip(pending > 10, 'More than 10 pending: that is TC-ADV-03');
    await advertiserAccountsPage.expectPendingBadge(pending);
  });

  test('TC-ADV-06 | Listing shows every required column', { tag: ['@smoke', '@regression', '@TC-ADV-06'] }, async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.expectColumns();
    await advertiserAccountsPage.expectRowDetails(rowAt(0));
  });

  test('TC-ADV-07 | Newest joined advertisers come first', { tag: ['@regression', '@TC-ADV-07'] }, async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.expectNewestFirst();
  });

  test('TC-ADV-08 | Total count and pagination', { tag: ['@regression', '@TC-ADV-08'] }, async ({ advertiserAccountsPage }) => {
    // with 10 or fewer advertisers there is one page: the count is still checked, the pager part only above 10
    await advertiserAccountsPage.expectPagination(await advertiserAccountsPage.totalCount());
  });
});

test.describe('Advertiser Accounts: search', () => {
  test.beforeEach(async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.open();
    await advertiserAccountsPage.expectLoaded();
  });

  test('TC-ADV-09 | Search by advertiser name', { tag: ['@regression', '@TC-ADV-09'] }, async ({ advertiserAccountsPage }) => {
    const advertiser = await advertiserAccountsPage.readRow(rowAt(0));
    const term = partOf.name(advertiser.company);
    await advertiserAccountsPage.search(term);
    await advertiserAccountsPage.expectEveryRowContains(term);
    await advertiserAccountsPage.verify.visible(rowOf(advertiser.email));
  });

  test('TC-ADV-10 | Search by email, part or full', { tag: ['@regression', '@TC-ADV-10'] }, async ({ advertiserAccountsPage }) => {
    const advertiser = await advertiserAccountsPage.readRow(rowAt(0));
    await advertiserAccountsPage.search(partOf.emailDomain(advertiser.email));
    await advertiserAccountsPage.verify.visible(rowOf(advertiser.email));
    await advertiserAccountsPage.search(advertiser.email);
    await advertiserAccountsPage.expectEveryRowContains(advertiser.email);
  });

  test('TC-ADV-11 | Search by part of a phone number', { tag: ['@regression', '@TC-ADV-11'] }, async ({ advertiserAccountsPage }) => {
    const advertiser = await advertiserAccountsPage.readRow(rowAt(0));
    const digits = partOf.phoneDigits(advertiser.phone);
    await advertiserAccountsPage.search(digits);
    await advertiserAccountsPage.verify.visible(rowOf(advertiser.email));
  });

  test('TC-ADV-13 | Search without a match shows the empty message', { tag: ['@regression', '@TC-ADV-13'] }, async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.search(noMatchTerm());
    await advertiserAccountsPage.expectNoResults();
  });
});

test.describe('Advertiser Accounts: filters', () => {
  test.beforeEach(async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.open();
    await advertiserAccountsPage.expectLoaded();
  });

  test('TC-ADV-14 | Filter by status', { tag: ['@regression', '@TC-ADV-14'] }, async ({ advertiserAccountsPage }) => {
    const total = await advertiserAccountsPage.totalCount();
    for (const status of ['Pending', 'Approved', 'Blocked'] as const) {
      await advertiserAccountsPage.filterByStatus(StatusOptions[status.toLowerCase() as 'pending' | 'approved' | 'blocked']);
      await advertiserAccountsPage.expectOnlyStatus(status);
    }
    await advertiserAccountsPage.filterByStatus(StatusOptions.all);
    await advertiserAccountsPage.verify.text(advertiserAccountsPage.fields.totalCount, `${total} total`);
  });

  test('TC-ADV-15 | Filter by one advertiser', { tag: ['@regression', '@TC-ADV-15'] }, async ({ advertiserAccountsPage }) => {
    const approved = await advertiserAccountsPage.firstRowWithStatus('Approved');
    test.skip(!approved, 'No approved advertiser on this environment (the advertiser filter lists approved ones)');
    await advertiserAccountsPage.filterByAdvertiser(approved!.data.company);
    await advertiserAccountsPage.expectOnlyAdvertiser(approved!.data.company);
  });

  test('TC-ADV-16 | Status, advertiser and search filters work together', { tag: ['@regression', '@TC-ADV-16'] }, async ({ advertiserAccountsPage }) => {
    const approved = await advertiserAccountsPage.firstRowWithStatus('Approved');
    test.skip(!approved, 'No approved advertiser on this environment');
    const { company } = approved!.data;
    await advertiserAccountsPage.open();
    await advertiserAccountsPage.filterByStatus(StatusOptions.approved);
    await advertiserAccountsPage.filterByAdvertiser(company);
    await advertiserAccountsPage.search(partOf.name(company));
    await advertiserAccountsPage.expectOnlyAdvertiser(company);
  });
});

test.describe('Advertiser Accounts: actions per status', () => {
  test('TC-ADV-17 | A pending advertiser can only be approved or deleted', { tag: ['@regression', '@TC-ADV-17'] }, async ({ advertiserAccountsPage }) => {
    const pending = await advertiserAccountsPage.firstRowWithStatus('Pending');
    test.skip(!pending, 'No pending advertiser on this environment');
    await advertiserAccountsPage.expectActions(pending!.row, ['Approve', 'Delete']);
  });

  test('TC-ADV-19 | An approved advertiser can only be blocked or deleted', { tag: ['@regression', '@TC-ADV-19'] }, async ({ advertiserAccountsPage }) => {
    const approved = await advertiserAccountsPage.firstRowWithStatus('Approved');
    test.skip(!approved, 'No approved advertiser on this environment');
    await advertiserAccountsPage.expectActions(approved!.row, ['Block', 'Delete']);
  });

  test('TC-ADV-22 | A blocked advertiser can only be unblocked or deleted', { tag: ['@regression', '@TC-ADV-22'] }, async ({ advertiserAccountsPage }) => {
    const blocked = await advertiserAccountsPage.firstRowWithStatus('Blocked');
    test.skip(!blocked, 'No blocked advertiser on this environment');
    await advertiserAccountsPage.expectActions(blocked!.row, ['Unblock', 'Delete']);
  });

  test('TC-ADV-27 | Cancelling Block or Delete changes nothing', { tag: ['@regression', '@TC-ADV-27'] }, async ({ advertiserAccountsPage }) => {
    const approved = await advertiserAccountsPage.firstRowWithStatus('Approved');
    test.skip(!approved, 'No approved advertiser on this environment');
    const { row } = approved!;
    await advertiserAccountsPage.openBlockDialog(row);
    await advertiserAccountsPage.cancelDialog();
    await advertiserAccountsPage.expectStatus(row, 'Approved');
    await advertiserAccountsPage.openDeleteDialog(row);
    await advertiserAccountsPage.cancelDialog();
    await advertiserAccountsPage.expectStatus(row, 'Approved');
  });
});

test.describe('Advertiser Accounts: block and unblock (changes data)', () => {
  // they change one seeded advertiser and the shared counts: one at a time
  test.describe.configure({ mode: 'serial' });

  test('TC-ADV-20 | Block an approved advertiser after confirming', { tag: ['@regression', '@TC-ADV-20'] }, async ({ advertiserAccountsPage, cleanup }) => {
    pendingDecision('D17', 'Build shows a different Block dialog ("Block this account?" … "Block account")');
    const email = seededApprovedAdvertiser();
    test.skip(!email, needsSeededAdvertiser);
    const row = rowOf(email);
    await advertiserAccountsPage.openWith({ q: email });
    // put the advertiser back however the test ends
    cleanup.add('Unblock the seeded advertiser again', async () => {
      if (await advertiserAccountsPage.isBlocked(row)) await advertiserAccountsPage.unblock(row);
    });
    await advertiserAccountsPage.openBlockDialog(row);
    await advertiserAccountsPage.expectDialogText(AdvertiserMessages.blockDialog);
    await advertiserAccountsPage.confirmBlock();
    await advertiserAccountsPage.expectStatus(row, 'Blocked');
  });

  test('TC-ADV-23 | Unblock a blocked advertiser', { tag: ['@regression', '@TC-ADV-23'] }, async ({ advertiserAccountsPage, cleanup }) => {
    const email = seededApprovedAdvertiser();
    test.skip(!email, needsSeededAdvertiser);
    const row = rowOf(email);
    await advertiserAccountsPage.openWith({ q: email });
    cleanup.add('Unblock the seeded advertiser again', async () => {
      if (await advertiserAccountsPage.isBlocked(row)) await advertiserAccountsPage.unblock(row);
    });
    if (!(await advertiserAccountsPage.isBlocked(row))) await advertiserAccountsPage.block(row);
    await advertiserAccountsPage.unblock(row);
    // "regains login access" is checked by hand (the advertiser's website / app, like TC-ADV-21)
    await advertiserAccountsPage.expectStatus(row, 'Approved');
  });
});

test.describe('Advertiser Accounts: export', () => {
  test.beforeEach(async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.open();
    await advertiserAccountsPage.expectLoaded();
  });

  test('TC-ADV-28 | Export the full list to CSV', { tag: ['@regression', '@TC-ADV-28'] }, async ({ advertiserAccountsPage }) => {
    pendingDecision('D19', 'Build exports Excel (Advertiser_Accounts_<date>.xlsx) instead of CSV');
    const total = await advertiserAccountsPage.totalCount();
    const listed = await advertiserAccountsPage.listedEmails();
    const file = await advertiserAccountsPage.export();
    await advertiserAccountsPage.expectCsvExport(file, { count: total, includes: listed });
  });

  test('TC-ADV-29 | Export only the filtered results', { tag: ['@regression', '@TC-ADV-29'] }, async ({ advertiserAccountsPage }) => {
    pendingDecision('D19', 'Build exports Excel (Advertiser_Accounts_<date>.xlsx) instead of CSV');
    const advertiser = await advertiserAccountsPage.readRow(rowAt(0));
    await advertiserAccountsPage.search(advertiser.email);
    const listed = await advertiserAccountsPage.listedEmails();
    const file = await advertiserAccountsPage.export();
    await advertiserAccountsPage.expectCsvExport(file, { count: listed.length, includes: listed });
  });

  test('TC-ADV-30 | Export with no records shows a message and downloads nothing', { tag: ['@regression', '@TC-ADV-30'] }, async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.search(noMatchTerm());
    await advertiserAccountsPage.expectNoResults();
    await advertiserAccountsPage.expectNothingToExport();
  });
});

test.describe('Advertiser Accounts: quality', () => {
  test('TC-ADV-31 | Advertiser Accounts page is accessible', { tag: ['@regression', '@a11y', '@TC-ADV-31'] }, async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.open();
    await advertiserAccountsPage.expectLoaded();
    await advertiserAccountsPage.verify.accessible();
  });

  test('TC-ADV-32 | Advertiser Accounts page loads fast', { tag: ['@regression', '@perf', '@TC-ADV-32'] }, async ({ advertiserAccountsPage }) => {
    await advertiserAccountsPage.open();
    await advertiserAccountsPage.verify.performance();
  });
});
