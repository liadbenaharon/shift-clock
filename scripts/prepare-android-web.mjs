import { mkdir, rm, copyFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'web');
const files = [
  'index.html',
  'push-client.js',
  'updater.js',
  'version.json',
  'manifest.json',
  'service-worker.js'
];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  try {
    await access(src);
    await copyFile(src, path.join(out, file));
  } catch (_) {
    if (file === 'service-worker.js') continue;
    throw new Error(`Required Android web asset is missing: ${file}`);
  }
}

console.log(`Prepared ${out} for Capacitor Android.`);
