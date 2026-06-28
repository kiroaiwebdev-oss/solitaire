/**
 * Build script: generates per-platform dist/<platform>/ and zip files.
 * Run with: node tools/build.mjs
 * Uses ONLY Node.js stdlib (fs, path, zlib).
 */

import { mkdirSync, cpSync, existsSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateRawSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const platforms = ['standalone', 'crazygames', 'gamedistribution', 'y8', 'playhop'];

const sdkUrls = {
  standalone: null,
  crazygames: 'https://sdk.crazygames.com/crazygames-sdk-v3.js',
  gamedistribution: 'https://html5.api.gamedistribution.com/main.min.js',
  y8: 'https://cdn.y8.com/api/sdk.js',
  playhop: 'https://cdn.playgama.com/sdk/bridge.js'
};

const filesToCopy = [
  'index.html',
  'styles.css',
  'manifest.json',
  'sw.js',
  'src/main.js',
  'src/core/loop.js',
  'src/core/input.js',
  'src/core/math.js',
  'src/core/render.js',
  'src/core/audio.js',
  'src/game/game.js',
  'src/game/card.js',
  'src/game/deck.js',
  'src/game/tableau.js',
  'src/game/foundation.js',
  'src/game/stock.js',
  'src/game/drag.js',
  'src/systems/save-manager.js',
  'src/systems/progression.js',
  'src/systems/daily-challenge.js',
  'src/systems/achievements.js',
  'src/ui/hud.js',
  'src/ui/screens.js',
  'src/ui/text-fit.js',
  'src/ui/particles.js',
  'src/ui/animations.js',
  'src/platform/adapter.js',
  'src/platform/standalone.js',
  'src/platform/crazygames.js',
  'src/platform/gamedistribution.js',
  'src/platform/y8.js',
  'src/platform/playhop.js',
  'src/platform/sdkUtil.js',
  'src/platform/index.js',
  'src/config/scoring.js',
  'src/config/themes.js',
  'src/config/daily-seeds.js',
  'src/config/achievements.js'
];

const buildVersion = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

function buildIndexHtml(htmlContent, platform) {
  const sdkUrl = sdkUrls[platform];
  let injection = ``;
  injection += `  <meta name="build-version" content="${buildVersion}">\n`;
  injection += `  <script>window.__PLATFORM__ = '${platform}'; window.__BUILD_VERSION__ = '${buildVersion}';</script>\n`;
  if (sdkUrl) {
    injection += `  <script src="${sdkUrl}"></script>\n`;
  }
  const modified = htmlContent.replace('</head>', injection + '</head>');
  return modified;
}

function createZipBuffer(files) {
  const centralEntries = [];
  let offset = 0;
  const chunks = [];

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, 'utf8');
    const uncompressedData = file.data;
    const compressedData = deflateRawSync(uncompressedData);
    const crc = crc32(uncompressedData);
    const useCompressed = compressedData.length < uncompressedData.length;
    const storedData = useCompressed ? compressedData : uncompressedData;
    const method = useCompressed ? 8 : 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(storedData.length, 18);
    localHeader.writeUInt32LE(uncompressedData.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, nameBuffer, storedData);

    const centralEntry = Buffer.alloc(46);
    centralEntry.writeUInt32LE(0x02014b50, 0);
    centralEntry.writeUInt16LE(20, 4);
    centralEntry.writeUInt16LE(20, 6);
    centralEntry.writeUInt16LE(0, 8);
    centralEntry.writeUInt16LE(method, 10);
    centralEntry.writeUInt16LE(0, 12);
    centralEntry.writeUInt16LE(0, 14);
    centralEntry.writeUInt32LE(crc, 16);
    centralEntry.writeUInt32LE(storedData.length, 20);
    centralEntry.writeUInt32LE(uncompressedData.length, 24);
    centralEntry.writeUInt16LE(nameBuffer.length, 28);
    centralEntry.writeUInt16LE(0, 30);
    centralEntry.writeUInt16LE(0, 32);
    centralEntry.writeUInt16LE(0, 34);
    centralEntry.writeUInt16LE(0, 36);
    centralEntry.writeUInt32LE(0, 38);
    centralEntry.writeUInt32LE(offset, 42);

    centralEntries.push({ header: centralEntry, name: nameBuffer });
    offset += localHeader.length + nameBuffer.length + storedData.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const entry of centralEntries) {
    chunks.push(entry.header, entry.name);
    centralDirSize += entry.header.length + entry.name.length;
  }

  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralDirSize, 12);
  endRecord.writeUInt32LE(centralDirOffset, 16);
  endRecord.writeUInt16LE(0, 20);
  chunks.push(endRecord);
  return Buffer.concat(chunks);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) { crc = (crc >>> 1) ^ 0xEDB88320; } else { crc = crc >>> 1; }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

console.log('=== Building Premium Solitaire ===');
console.log(`Build version: ${buildVersion}\n`);

const distDir = join(rootDir, 'dist');
if (existsSync(distDir)) rmSync(distDir, { recursive: true });
mkdirSync(distDir, { recursive: true });

const indexHtmlTemplate = readFileSync(join(rootDir, 'index.html'), 'utf8');
let totalSuccess = 0;

for (const platform of platforms) {
  const platformDir = join(distDir, platform);
  console.log(`Building for: ${platform}`);
  mkdirSync(platformDir, { recursive: true });

  const zipFiles = [];
  let fileCount = 0;

  for (const file of filesToCopy) {
    const src = join(rootDir, file);
    if (!existsSync(src)) { console.warn(`  Warning: ${file} not found, skipping`); continue; }
    const dest = join(platformDir, file);
    mkdirSync(dirname(dest), { recursive: true });

    if (file === 'index.html') {
      const modified = buildIndexHtml(indexHtmlTemplate, platform);
      writeFileSync(dest, modified, 'utf8');
      zipFiles.push({ name: file, data: Buffer.from(modified, 'utf8') });
    } else {
      cpSync(src, dest);
      zipFiles.push({ name: file.replace(/\\\\/g, '/'), data: readFileSync(src) });
    }
    fileCount++;
  }

  console.log(`  Copied ${fileCount} files to dist/${platform}/`);

  const zipPath = join(distDir, platform + '.zip');
  const zipBuffer = createZipBuffer(zipFiles);
  writeFileSync(zipPath, zipBuffer);
  const zipSizeKB = (zipBuffer.length / 1024).toFixed(1);
  console.log(`  Created ${platform}.zip (${zipSizeKB} KB, ${zipFiles.length} files)`);

  const builtIndex = readFileSync(join(platformDir, 'index.html'), 'utf8');
  if (!builtIndex.includes(`window.__PLATFORM__ = '${platform}'`)) {
    console.error(`  ERROR: Platform marker not found in ${platform}/index.html`);
    process.exit(1);
  }
  if (!builtIndex.includes(buildVersion)) {
    console.error(`  ERROR: Build version not found in ${platform}/index.html`);
    process.exit(1);
  }
  if (sdkUrls[platform] && !builtIndex.includes(sdkUrls[platform])) {
    console.error(`  ERROR: SDK URL not found in ${platform}/index.html`);
    process.exit(1);
  }

  console.log(`  Validated ${platform} build`);
  totalSuccess++;
}

console.log(`\n=== Build complete: ${totalSuccess}/${platforms.length} platforms ===`);
if (totalSuccess !== platforms.length) process.exit(1);
