import AxeBuilder from '@axe-core/playwright';
import { test, type Page } from '@playwright/test';
import { app, type AccessibilitySettings, type Impact } from '@core/config/app';

const IMPACTS: Impact[] = ['minor', 'moderate', 'serious', 'critical'];
const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface AccessibilityOptions extends AccessibilitySettings {
  /** CSS selector of the part of the page to check. Default: the whole page. */
  within?: string;
}

/**
 * Scan the current page with axe-core. Every violation is attached to the report ("Accessibility report");
 * violations at or above `failOn` fail the check. Settings combine the app's `checks.accessibility` with `options`.
 */
export async function checkAccessibility(page: Page, options: AccessibilityOptions = {}): Promise<void> {
  const defaults = app.checks?.accessibility ?? {};
  const failOn = options.failOn ?? defaults.failOn ?? 'serious';
  const ignoreRules = [...(defaults.ignoreRules ?? []), ...(options.ignoreRules ?? [])];

  let axe = new AxeBuilder({ page }).withTags(options.standard ?? defaults.standard ?? WCAG_21_AA);
  if (ignoreRules.length) axe = axe.disableRules(ignoreRules);
  for (const selector of [...(defaults.exclude ?? []), ...(options.exclude ?? [])]) axe = axe.exclude(selector);
  if (options.within) axe = axe.include(options.within);
  const { violations } = await axe.analyze();
  if (!violations.length) return;

  const sorted = [...violations].sort((a, b) => rank(b.impact) - rank(a.impact));
  const describe = (v: (typeof violations)[number]) =>
    `[${v.impact ?? 'minor'}] ${v.id}: ${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? '' : 's'}, e.g. ${v.nodes[0]?.target.join(' ')})`;
  await test.info().attach('Accessibility report', {
    body: [
      `Page: ${page.url()}`,
      `Fails on: ${failOn} or worse${ignoreRules.length ? ` · Ignored rules: ${ignoreRules.join(', ')}` : ''}`,
      '',
      ...sorted.flatMap((v) => [describe(v), `    ${v.helpUrl}`, ...v.nodes.slice(0, 5).map((n) => `    - ${n.target.join(' ')}: ${n.html.slice(0, 160)}`), '']),
    ].join('\n'),
    contentType: 'text/plain',
  });

  const failing = sorted.filter((v) => rank(v.impact) >= rank(failOn));
  if (failing.length) {
    throw new Error(
      `${failing.length} accessibility violation${failing.length === 1 ? '' : 's'} (${failOn} or worse) on ${page.url()}:\n` +
        failing.map((v) => `  ${describe(v)}`).join('\n') +
        '\nDetails and affected elements: see the "Accessibility report" attachment.',
    );
  }
}

function rank(impact: string | null | undefined): number {
  return Math.max(0, IMPACTS.indexOf((impact ?? 'minor') as Impact));
}
