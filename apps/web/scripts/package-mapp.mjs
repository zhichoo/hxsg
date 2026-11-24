import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pack } from '@discourse-mini-app/sdk/pack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const webDistDir = path.join(webRoot, 'dist-mapp/web');
const publicAssetsDir = path.join(webRoot, 'mapp/assets');
const outputDirectory = path.join(webRoot, 'dist-mapp/package');

const apiBaseRaw = (process.env.MAPP_API_BASE_URL || 'https://api.example.com').replace(/\/+$/, '');
const parsedApi = new URL(apiBaseRaw);
if (parsedApi.protocol !== 'https:') {
  throw new Error(`MAPP_API_BASE_URL must use https:// (got ${apiBaseRaw})`);
}
const wsBaseRaw = (process.env.MAPP_WS_BASE_URL || apiBaseRaw.replace(/^https:/i, 'wss:')).replace(
  /\/+$/,
  '',
);

const assetMode = process.env.MAPP_ASSET_MODE === 'cdn' ? 'cdn' : 'bundle';
const cdnBaseRaw = (process.env.MAPP_CDN_BASE_URL || '').replace(/\/+$/, '');
if (assetMode === 'cdn' && !cdnBaseRaw.startsWith('https://')) {
  throw new Error('MAPP_ASSET_MODE=cdn requires an https:// MAPP_CDN_BASE_URL');
}

function guessMime(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'application/octet-stream';
}

async function collectFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const out = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(abs, rel)));
    } else if (entry.isFile()) {
      out.push({ abs, rel });
    }
  }
  return out;
}

const templateText = await readFile(path.join(webRoot, 'mapp/manifest.template.json'), 'utf8');
const hydratedText = templateText
  .replaceAll('__API_BASE__', apiBaseRaw)
  .replaceAll('__WS_BASE__', wsBaseRaw);

const manifest = JSON.parse(hydratedText);
if (process.env.MINI_APP_ID) manifest.id = process.env.MINI_APP_ID.trim();
if (process.env.MINI_APP_VERSION) manifest.version = process.env.MINI_APP_VERSION.trim();

const files = {
  'index.html': await readFile(path.join(webRoot, 'mapp/template.html')),
  'app.js': await readFile(path.join(webDistDir, 'app.js')),
  'app.css': await readFile(path.join(webDistDir, 'app.css')),
  'strings.json': await readFile(path.join(webRoot, 'mapp/strings.json')),
};

const assetList = await collectFiles(publicAssetsDir);

if (assetMode === 'bundle') {
  manifest.assets = [];
  for (const item of assetList) {
    const virtualPath = `assets/hxsg/${item.rel}`;
    manifest.assets.push(virtualPath);
    files[virtualPath] = await readFile(item.abs);
  }
} else {
  if (!manifest.permissions.includes('assets.remote')) {
    manifest.permissions.push('assets.remote');
  }
  manifest.remote_assets = {};
  for (const item of assetList) {
    const bytes = await readFile(item.abs);
    const virtualPath = `assets/hxsg/${item.rel}`;
    const encodedRel = item.rel
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    manifest.remote_assets[virtualPath] = {
      url: `${cdnBaseRaw}/${encodedRel}`,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      size: bytes.byteLength,
      mime: guessMime(item.rel),
    };
  }
}

const result = await pack({
  manifest,
  files,
  outputDirectory,
});

const zipMiB = (result.size / (1024 * 1024)).toFixed(2);
console.log(
  `[MAPP] Packed ${result.file} (${zipMiB} MiB, mode=${assetMode}, assets=${assetList.length}, id=${manifest.id}, version=${manifest.version})`,
);
console.log(`[MAPP] ZIP SHA-256: ${result.zipSha256}`);
