import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const unpackedDir = path.join(rootDir, 'raw', 'unpacked');
const outDir = path.join(rootDir, 'apps', 'web', 'public', 'assets', 'hxsg');

if (!fs.existsSync(unpackedDir)) {
  console.error('Missing raw/unpacked directory. Please unpack raw/hxsgV171.apk first.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(outDir, 'portraits'), { recursive: true });

let copied = 0;

function walkAndCopy(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkAndCopy(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.png')) {
      if (
        entry.name.startsWith('notification_') ||
        entry.name.startsWith('notify_') ||
        entry.name.endsWith('.9.png')
      ) {
        continue;
      }
      const target = path.join(outDir, entry.name);
      // Prefer hdpi over mdpi/default if duplicates exist
      const isHdpi = fullPath.includes('drawable-hdpi');
      if (!fs.existsSync(target) || isHdpi) {
        fs.copyFileSync(fullPath, target);
        copied++;
      }
    }
  }
}

walkAndCopy(path.join(unpackedDir, 'res'));

// Convert assets/*.sgp (raw PNGs) into portraits/*.png
const assetsDir = path.join(unpackedDir, 'assets');
if (fs.existsSync(assetsDir)) {
  for (const name of fs.readdirSync(assetsDir)) {
    if (name.endsWith('.sgp')) {
      const src = path.join(assetsDir, name);
      const dst = path.join(outDir, 'portraits', name.replace(/\.sgp$/, '.png'));
      fs.copyFileSync(src, dst);
      copied++;
    }
  }
}

console.log(`Synced ${copied} PNG assets to ${path.relative(rootDir, outDir)}`);
