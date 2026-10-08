/**
 * Videos and traces of a saved run are kept next to its report.html in evidence/ (src/report/archive.ts),
 * one name per test attempt, so the Bug report can say exactly which file to open:
 *   TC-FP-13.web-chrome.webm           first attempt
 *   TC-FP-13.web-chrome.retry1.webm    first retry
 */
export const EVIDENCE_DIR = 'evidence';

/** The test case ID from a title "<ID> | <Title>", or the cleaned-up title. */
export function evidenceBase(title: string): string {
  return (title.split(' | ')[0] || 'test').replace(/[^\w.-]+/g, '_').slice(0, 60);
}

export function evidenceName(title: string, project: string, retry: number, ext: string): string {
  return `${evidenceBase(title)}.${project.replace(/[^\w-]+/g, '_')}${retry ? `.retry${retry}` : ''}${ext}`;
}
