// vite's emptyOutDir only clears dist/app now that the app builds one level
// down, so the root files this script's sibling copies in would otherwise
// accumulate across builds. Start from nothing every time.
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await rm(resolve(root, 'dist'), { recursive: true, force: true });
console.log('cleaned dist/');
