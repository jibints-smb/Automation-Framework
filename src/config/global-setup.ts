import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from './env';

/** Runs once before the whole test run: start every run with fresh Allure results. */
export default function globalSetup() {
  fs.rmSync(path.join(ROOT_DIR, 'allure-results'), { recursive: true, force: true });
}
