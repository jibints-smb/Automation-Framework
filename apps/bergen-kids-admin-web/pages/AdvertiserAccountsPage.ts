import fs from 'node:fs';
import path from 'node:path';
import { expect } from '@core/fixtures';
import type { WebField } from '@core/models/field.types';
import { step } from '@core/utils/step';
import {
  AdvertiserColumns,
  AdvertiserFields,
  AdvertiserMessages,
  DialogFields,
  StatusOptions,
  rowAt,
  rowOf,
  rowParts,
  summaryCard,
} from '@apps/bergen-kids-admin-web/models/web/advertiser-accounts.model';
import { AppPage } from '@apps/bergen-kids-admin-web/pages/AppPage';

/** What one table row shows. */
export interface AdvertiserRow {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
}

export type AdvertiserStatus = 'Approved' | 'Pending' | 'Blocked';

/** Advertiser Accounts (`/advertisers`): listing, search, filters, approve / block / unblock / delete, export. */
export class AdvertiserAccountsPage extends AppPage {
  readonly path = '/advertisers';
  readonly fields = AdvertiserFields;

  /** Opens the page with search / filter parameters already applied, e.g. `{ status: 'pending' }`. */
  async openWith(params: Record<string, string>): Promise<void> {
    await this.act.goto(`${this.path}?${new URLSearchParams(params)}`);
    await this.expectSplashGone();
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await this.verify.visible(this.fields.heading);
    await this.verify.visible(this.fields.totalCount);
  }

  /** The "<n> total" count of the current list. */
  async totalCount(): Promise<number> {
    return Number((await this.act.getText(this.fields.totalCount)).match(/\d+/)?.[0] ?? 0);
  }

  // ───── summary cards and badge ─────

  async expectSummaryCards(): Promise<void> {
    await step('Verify summary cards Total Advertisers, Approved, Pending and Total revenue', async () => {
      for (const label of ['Total Advertisers', 'Approved', 'Pending']) {
        await this.verify.text(summaryCard(label), new RegExp(`^\\s*\\d+\\s*${label}\\s*$`, 'i'));
      }
      // Sprint 1: no ad payments yet, so revenue is 0
      await this.verify.text(summaryCard('Total revenue'), /^\s*\$?0(\.00)?\s*Total revenue\s*$/i);
    });
  }

  /** Number of advertisers waiting for approval (the Pending filter's total). */
  async pendingCount(): Promise<number> {
    await this.openWith({ status: 'pending' });
    return this.totalCount();
  }

  /** The sidebar badge: the exact count up to 10, "10+" above. */
  async expectPendingBadge(pending: number): Promise<void> {
    const shown = pending > 10 ? '10\\+' : String(pending);
    await this.verify.text(this.fields.sidebarLink, new RegExp(`^\\s*Advertiser Accounts\\s*${shown}\\s*$`));
  }

  // ───── table ─────

  async expectColumns(): Promise<void> {
    await step(`Verify table columns ${AdvertiserColumns.join(', ')}`, async () => {
      const headers = (await this.act.getAllTexts(this.fields.columnHeaders)).map((h) => h.toLowerCase());
      expect(headers).toEqual(AdvertiserColumns.map((c) => c.toLowerCase()));
    });
  }

  /** One row shows avatar, company with address and website, contact name / email / phone, joined, ads, revenue, status, actions. */
  async expectRowDetails(row: WebField = rowAt(0)): Promise<void> {
    const cells = rowParts(row);
    await this.verify.visible(cells.avatar);
    await step('Verify the row shows a website link or "No website"', async () => {
      const website = this.act.locate(cells.website).or(this.act.locate(cells.noWebsite));
      await expect(website.first()).toBeVisible();
    });
    await this.verify.text(cells.contact, /\S+@\S+\.\S+[\s\S]*\+?\d[\d\s]{6,}/); // name, email, phone
    await this.verify.text(cells.joined, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    // Sprint 1: no ads or revenue yet: 0 or a placeholder
    await this.verify.text(cells.ads, /^(0|—|-)$/);
    await this.verify.text(cells.revenue, /^(\$?0(\.00)?|—|-)$/);
    await this.verify.text(cells.status, /^(Approved|Pending|Blocked)$/);
    await this.verify.visible(cells.delete);
  }

  async readRow(row: WebField): Promise<AdvertiserRow> {
    const cells = rowParts(row);
    const companyLines = (await this.act.getText(cells.company)).split('\n').map((l) => l.trim()).filter(Boolean);
    const contact = await this.act.getText(cells.contact);
    return {
      // first line is the avatar's initials
      company: companyLines[1] ?? companyLines[0] ?? '',
      contactName: contact.split('\n')[0].trim(),
      email: contact.match(/\S+@\S+\.\S+/)?.[0] ?? '',
      phone: contact.match(/\+?\d[\d\s]{6,}/)?.[0].trim() ?? '',
      status: await this.act.getText(cells.status),
    };
  }

  /** The first row with this status, or undefined when the list has none. */
  async firstRowWithStatus(status: AdvertiserStatus): Promise<{ row: WebField; data: AdvertiserRow } | undefined> {
    await this.openWith({ status: status.toLowerCase() });
    if (!(await this.totalCount())) return undefined;
    const statuses = await this.act.getAllTexts(this.fields.statuses);
    const index = statuses.indexOf(status);
    if (index < 0) return undefined;
    const data = await this.readRow(rowAt(index));
    return { row: rowOf(data.email), data };
  }

  async expectNewestFirst(): Promise<void> {
    await step('Verify rows are sorted by joined date, newest first', async () => {
      const dates = (await this.act.getAllTexts(this.fields.joinedDates)).map((d) => Date.parse(d));
      expect(dates.every((d) => !Number.isNaN(d)), 'every joined date is a date').toBe(true);
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });
  }

  /** Up to 10 rows per page; the pager moves to the next page and back. */
  async expectPagination(total: number): Promise<void> {
    await this.verify.count(this.fields.rows, Math.min(total, 10));
    if (total <= 10) return;
    const firstRow = await this.readRow(rowAt(0));
    await this.act.click(this.fields.pagerNext);
    await this.verify.url(/page=2/);
    await this.verify.count(this.fields.rows, Math.min(total - 10, 10));
    await this.act.click(this.fields.pagerPrevious);
    await this.verify.containsText(rowAt(0), firstRow.email);
  }

  // ───── search and filters ─────

  async search(term: string): Promise<void> {
    await this.act.fill(this.fields.search, term);
    await this.verify.url(new RegExp(`[?&]q=${encodeURIComponent(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }

  /** Every row of the list contains the text (case-insensitive). */
  async expectEveryRowContains(text: string): Promise<void> {
    await step(`Verify every row contains "${text}"`, async () => {
      const rows = await this.act.getAllTexts(this.fields.rows);
      expect(rows.length, 'at least one row').toBeGreaterThan(0);
      for (const row of rows) expect(row.toLowerCase()).toContain(text.toLowerCase());
    });
  }

  async expectNoResults(): Promise<void> {
    await this.verify.containsText(this.fields.emptyState, AdvertiserMessages.noResults);
  }

  async filterByStatus(option: (typeof StatusOptions)[keyof typeof StatusOptions]): Promise<void> {
    await this.act.select(this.fields.statusFilter, option);
    if (option === StatusOptions.all) await this.verify.url(/^(?!.*status=)/);
    else await this.verify.url(new RegExp(`status=${option.toLowerCase()}`));
  }

  /** Every listed advertiser has this status (an empty list passes: nobody has it). */
  async expectOnlyStatus(status: AdvertiserStatus): Promise<void> {
    await step(`Verify every row has status ${status}`, async () => {
      if ((await this.totalCount()) === 0) return this.expectNoResults();
      const statuses = await this.act.getAllTexts(this.fields.statuses);
      expect(new Set(statuses)).toEqual(new Set([status]));
    });
  }

  async filterByAdvertiser(company: string): Promise<void> {
    await this.act.select(this.fields.advertiserFilter, company);
    await this.verify.url(/adv=/);
  }

  async expectOnlyAdvertiser(company: string): Promise<void> {
    await this.verify.count(this.fields.rows, 1);
    await this.verify.containsText(rowAt(0), company);
  }

  // ───── actions ─────

  /** The row offers exactly these actions (icon buttons: checked by their accessible names, not their text). */
  async expectActions(row: WebField, actions: Array<'Approve' | 'Block' | 'Unblock' | 'Delete'>): Promise<void> {
    await step(`Verify the row offers only ${actions.join(' and ')}`, async () => {
      const parts = rowParts(row);
      const all = { Approve: parts.approve, Block: parts.block, Unblock: parts.unblock, Delete: parts.delete };
      for (const [name, field] of Object.entries(all)) {
        if (actions.includes(name as keyof typeof all)) await this.verify.visible(field);
        else await this.verify.hidden(field);
      }
      await this.verify.count(parts.actions, actions.length);
    });
  }

  async expectStatus(row: WebField, status: AdvertiserStatus): Promise<void> {
    await this.verify.text(rowParts(row).status, status);
  }

  async openBlockDialog(row: WebField): Promise<void> {
    await this.act.click(rowParts(row).block);
    await this.verify.visible(this.fields.dialog);
  }

  async openDeleteDialog(row: WebField): Promise<void> {
    await this.act.click(rowParts(row).delete);
    await this.verify.visible(this.fields.dialog);
  }

  async expectDialogText(text: string | RegExp): Promise<void> {
    await this.verify.containsText(this.fields.dialog, text);
  }

  async confirmBlock(): Promise<void> {
    await this.act.click(DialogFields.block);
    await this.verify.hidden(this.fields.dialog);
  }

  async cancelDialog(): Promise<void> {
    await this.act.click(DialogFields.cancel);
    await this.verify.hidden(this.fields.dialog);
  }

  async block(row: WebField): Promise<void> {
    await step('Block the advertiser', async () => {
      await this.openBlockDialog(row);
      await this.confirmBlock();
      await this.expectStatus(row, 'Blocked');
    });
  }

  /** Unblock, confirming the dialog when the build asks for it. */
  async unblock(row: WebField): Promise<void> {
    await step('Unblock the advertiser', async () => {
      await this.act.click(rowParts(row).unblock);
      if (await this.act.isVisible(this.fields.dialog)) await this.act.click(DialogFields.unblock);
      await this.verify.hidden(rowParts(row).unblock);
    });
  }

  async isBlocked(row: WebField): Promise<boolean> {
    return (await this.act.getText(rowParts(row).status)) === 'Blocked';
  }

  // ───── export ─────

  /** Exports the current list; returns the downloaded file's path. */
  async export(): Promise<string> {
    return this.act.download(this.fields.exportButton);
  }

  /** A CSV export with a header row and `count` advertisers, including these emails. */
  async expectCsvExport(file: string, expected: { count: number; includes: string[] }): Promise<void> {
    await step(`Verify ${path.basename(file)} is a CSV with ${expected.count} advertiser(s)`, async () => {
      expect(path.extname(file).toLowerCase(), 'export file type').toBe('.csv');
      const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
      expect(lines.length - 1, 'data rows').toBe(expected.count);
      for (const email of expected.includes) expect(lines.some((l) => l.includes(email)), `${email} in the export`).toBe(true);
    });
  }

  /** Export on an empty list: the message, and no file. */
  async expectNothingToExport(): Promise<void> {
    await step('Export an empty list: message and no download', async () => {
      let downloaded = false;
      const onDownload = () => (downloaded = true);
      this.page.on('download', onDownload);
      try {
        await this.act.click(this.fields.exportButton);
        await this.verify.containsText(this.fields.toast, AdvertiserMessages.nothingToExport);
        expect(downloaded, 'no file downloaded').toBe(false);
      } finally {
        this.page.off('download', onDownload);
      }
    });
  }

  /** All emails currently listed. */
  async listedEmails(): Promise<string[]> {
    return (await this.act.getAllTexts(this.fields.rows)).map((r) => r.match(/\S+@\S+\.\S+/)?.[0] ?? '').filter(Boolean);
  }
}
