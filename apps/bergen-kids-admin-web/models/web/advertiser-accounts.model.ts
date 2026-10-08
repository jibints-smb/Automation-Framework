/**
 * Advertiser Accounts (`/advertisers`) — field model.
 * Source: requirements/web/BK-7-advertiser-accounts.md; locators checked on staging 2026-10-08.
 * The page has no test IDs yet (the developers' notes promise advertiser-row / advertiser-status …): rows are found
 * by their text (the advertiser's email), cells by column; switch to the test IDs when they ship.
 */
import { defineWebFields, type WebField } from '@core/models/field.types';

/** Columns of the advertisers table, in order (the build's headers). */
export const AdvertiserColumns = ['Company', 'Contact Person', 'Joined', 'Ads', 'Revenue', 'Status', 'Actions'] as const;
const column = (name: (typeof AdvertiserColumns)[number]) => AdvertiserColumns.indexOf(name) + 1;

export const AdvertiserFields = defineWebFields({
  heading: { label: 'Advertiser Accounts heading', type: 'label', locator: { role: 'heading', name: 'Advertiser Accounts', exact: true } },
  /** Sidebar link; shows the pending-approval badge ("5", "10+") when advertisers wait for approval. */
  sidebarLink: {
    label: 'Sidebar: Advertiser Accounts',
    type: 'link',
    locator: { role: 'link', name: /^Advertiser Accounts/ },
    within: { label: 'Sidebar', type: 'label', locator: { role: 'navigation' }, nth: 0 },
  },
  totalCount: { label: 'Total count', type: 'label', locator: { text: /^\d+ total$/ } },
  search: { label: 'Search', type: 'text', locator: { role: 'searchbox', name: 'Search by company name, email or phone…' } },
  statusFilter: { label: 'Status filter', type: 'dropdown', locator: { role: 'combobox', name: 'All statuses' } },
  advertiserFilter: { label: 'Advertiser filter', type: 'dropdown', locator: { role: 'combobox', name: 'All advertisers' } },
  exportButton: { label: 'Export', type: 'button', locator: { role: 'button', name: /^(Export|Exporting…)$/ } },
  columnHeaders: { label: 'Column headers', type: 'label', locator: { role: 'columnheader' } },
  /** Data rows (the header row is in thead). */
  rows: { label: 'Advertiser rows', type: 'label', locator: { css: 'tbody tr' } },
  joinedDates: { label: 'Joined dates', type: 'label', locator: { css: `tbody tr td:nth-child(${column('Joined')})` } },
  statuses: { label: 'Status pills', type: 'label', locator: { css: `tbody tr td:nth-child(${column('Status')})` } },
  emptyState: { label: 'Empty list message', type: 'label', locator: { text: 'No advertiser accounts found.' } },
  pagerNext: { label: 'Next page', type: 'button', locator: { role: 'button', name: /next/i } },
  pagerPrevious: { label: 'Previous page', type: 'button', locator: { role: 'button', name: /prev/i } },
  dialog: { label: 'Confirmation dialog', type: 'label', locator: { role: 'alertdialog' } },
  toast: { label: 'Toast', type: 'label', locator: { role: 'status' } },
});

const dialog = AdvertiserFields.dialog;
/** Buttons inside the confirmation dialog (scoped: the row's "Approve" and the dialog's "Approve" share a name). */
export const DialogFields = defineWebFields({
  cancel: { label: 'Cancel (dialog)', type: 'button', locator: { role: 'button', name: 'Cancel', exact: true }, within: dialog },
  approve: { label: 'Approve (dialog)', type: 'button', locator: { role: 'button', name: 'Approve', exact: true }, within: dialog },
  block: { label: 'Block account (dialog)', type: 'button', locator: { role: 'button', name: 'Block account', exact: true }, within: dialog },
  unblock: { label: 'Unblock account (dialog)', type: 'button', locator: { role: 'button', name: 'Unblock account', exact: true }, within: dialog },
  delete: { label: 'Delete permanently (dialog)', type: 'button', locator: { role: 'button', name: 'Delete permanently', exact: true }, within: dialog },
});

/** Summary card by its label ("Total Advertisers", "Approved", "Pending", "Total revenue"): its text is "<value> <label>". */
export const summaryCard = (label: string): WebField => ({
  label: `${label} card`,
  type: 'label',
  locator: { css: `div:has(> div:text-matches("^${label}$", "i"))` },
  nth: 0,
});

/** The row of one advertiser, found by a unique text (their email). */
export const rowOf = (text: string): WebField => ({ label: `Row "${text}"`, type: 'label', locator: { css: 'tbody tr' }, hasText: text });
/** The first data row (or the n-th, 0-based). */
export const rowAt = (n: number): WebField => ({ label: `Row ${n + 1}`, type: 'label', locator: { css: 'tbody tr' }, nth: n });

/** Cells and controls inside one row. */
export const rowParts = (row: WebField) =>
  defineWebFields({
    company: { label: 'Company cell', type: 'label', locator: { css: `td:nth-child(${column('Company')})` }, within: row },
    avatar: { label: 'Avatar initials', type: 'label', locator: { css: `td:nth-child(${column('Company')}) span[aria-hidden="true"]` }, within: row, nth: 0 },
    website: { label: 'Website link', type: 'link', locator: { role: 'link', name: 'Website link' }, within: row },
    noWebsite: { label: 'No website', type: 'label', locator: { text: 'No website', exact: true }, within: row },
    contact: { label: 'Contact cell', type: 'label', locator: { css: `td:nth-child(${column('Contact Person')})` }, within: row },
    joined: { label: 'Joined cell', type: 'label', locator: { css: `td:nth-child(${column('Joined')})` }, within: row },
    ads: { label: 'Ads cell', type: 'label', locator: { css: `td:nth-child(${column('Ads')})` }, within: row },
    revenue: { label: 'Revenue cell', type: 'label', locator: { css: `td:nth-child(${column('Revenue')})` }, within: row },
    status: { label: 'Status', type: 'label', locator: { css: `td:nth-child(${column('Status')})` }, within: row },
    actions: { label: 'Action buttons', type: 'button', locator: { css: `td:nth-child(${column('Actions')}) button` }, within: row },
    approve: { label: 'Approve', type: 'button', locator: { role: 'button', name: 'Approve', exact: true }, within: row },
    block: { label: 'Block', type: 'button', locator: { role: 'button', name: 'Block', exact: true }, within: row },
    unblock: { label: 'Unblock', type: 'button', locator: { role: 'button', name: 'Unblock', exact: true }, within: row },
    delete: { label: 'Delete', type: 'button', locator: { role: 'button', name: 'Delete', exact: true }, within: row },
  });

/** Texts from the requirement (BK-7). The build differs for some: see the sprint's Differences table (D17–D19). */
export const AdvertiserMessages = {
  noResults: 'No advertiser accounts found.',
  nothingToExport: 'There are no advertiser accounts available to export.',
  blockDialog: /will lose access immediately\. You can unblock them at any time\./,
  deleteDialog: /will be permanently removed\. This cannot be undone\./,
} as const;

/** Status filter options. */
export const StatusOptions = { all: 'All statuses', approved: 'Approved', pending: 'Pending', blocked: 'Blocked' } as const;
