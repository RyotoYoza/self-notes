// Assembles the deployed site after `vite build`:
//
//   dist/index.html   the landing page
//   dist/sw.js        a tombstone that releases the old service worker
//   dist/app/         the app itself
//
// The app used to sit at the site root. Anyone who opened it back then still
// has a service worker registered at that scope, and it would go on serving
// the cached app instead of the new landing page — so the tombstone below
// ships at the old scope to unregister it.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  ['landing/index.html', 'dist/index.html'],
  ['site/sw.js', 'dist/sw.js'],
];

for (const [from, to] of files) {
  const dest = resolve(root, to);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(resolve(root, from), dest);
  console.log(`copied ${from} -> ${to}`);
}
