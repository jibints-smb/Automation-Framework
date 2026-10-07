// Renders the HTML guides in docs/ to PDF with Playwright's Chromium.
// Usage: npm run docs:pdf
import { chromium } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const guides = [
  { source: 'docs/qa-automation-guide.html', output: 'docs/QA-Automation-Guide.pdf', title: 'Module Testing &amp; Automation Guide' },
  { source: 'docs/getting-started-guide.html', output: 'docs/Getting-Started-Guide.pdf', title: 'Getting Started Guide' },
  { source: 'docs/sprint-qa-process.html', output: 'docs/Sprint-QA-Process.pdf', title: 'Sprint QA Process' },
  { source: 'docs/team-setup.html', output: 'docs/QA-Team-Setup.pdf', title: 'QA Team Setup' },
];

const footer = (title) => `
  <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:7.5pt;color:#5b6676;width:100%;padding:0 16mm;display:flex;justify-content:space-between;">
    <span>QA Automation Framework · ${title}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const guide of guides) {
  await page.goto(pathToFileURL(path.resolve(guide.source)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready); // web fonts (Google Fonts) before printing
  await page.pdf({
    path: path.resolve(guide.output),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: footer(guide.title),
    margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
  });
  console.log(`PDF written to ${path.resolve(guide.output)}`);
}
await browser.close();
