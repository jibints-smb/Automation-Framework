// Opens reports/index.html: the list of every saved test run (written by src/report/archive.ts).
// Usage: npm run reports
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const index = path.resolve('reports/index.html');
if (!fs.existsSync(index)) {
  console.error('No saved runs yet: run some tests first (e.g. npm run test:web).');
  process.exit(1);
}
const open = process.platform === 'win32' ? `start "" "${index}"` : process.platform === 'darwin' ? `open "${index}"` : `xdg-open "${index}"`;
exec(open);
console.log(`Opened ${index}`);
