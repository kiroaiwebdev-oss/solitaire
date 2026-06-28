/**
 * Build script: generates per-platform dist/<platform>/ directories and zip files.
 * Run with: node tools/build.mjs
 *
 * Uses ONLY Node.js stdlib (fs, path, zlib).
 * Creates dist/<platform>/ with all game files and dist/<platform>.zip with index.html at zip root.
 */

import { mkdirSync, cpSync, existsSync, writeFileSync, readFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, dirname, relative, sep } from 'path';
import { fileURLToPath } from 'url';
import { deflateRawSync } from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const platforms = ['standalone', 'crazygames', 'gamedistribution', 'y8', 'playhop'];

// SDK script URLs per platform (injected into index.html <head>)
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

// Cache-busting version stamp (timestamp-based)
const buildVersion = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

/**
 * Modify index.html for a specific platform:
 * - Inject SDK script tag before </head>
 * - Set window.__PLATFORM__
 * - Stamp cache-busting version
 */
function buildIndexHtml(htmlContent, platform) {
  const sdkUrl = sdkUrls[platform];

  // Build the injection block
  let injection = '';
  injection += `  <meta name="build-version" content="${buildVersion}">\n`;
  injection += `  <script>window.__PLATFORM__ = '${platform}'; window.__BUILD_VERSION__ = '${buildVersion}';</script>\n`;
  if (sdkUrl) {
    injection += `  <script src="${sdkUrl}"></script>\n`;
  }

  // Inject before </head>
  const modified = htmlContent.replace('</head>', injection + '</head>');
  return modified;
}

// ==================== Minimal ZIP Implementation ====================
// ZIP format: local file headers + file data, then central directory, then end record.

function createZipBuffer(files) {
  // files: Array of { name: string, data: Buffer }
  const localHeaders = [];
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
    const method = useCompressed ? 8 : 0; // 8 = deflate, 0 = store

    // Local file header (30 bytes + name + data)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);  // signature
    localHeader.writeUInt16LE(20, 4);           // version needed
    localHeader.writeUInt16LE(0, 6);            // flags
    localHeader.writeUInt16LE(method, 8);       // compression method
    localHeader.writeUInt16LE(0, 10);           // mod time
    localHeader.writeUInt16LE(0, 12);           // mod date
    localHeader.writeUInt32LE(crc, 14);         // crc-32
    localHeader.writeUInt32LE(storedData.length, 18);      // compressed size
    localHeader.writeUInt32LE(uncompressedData.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26);      // file name length
    localHeader.writeUInt16LE(0, 28);           // extra field length

    chunks.push(localHeader, nameBuffer, storedData);

    // Central directory entry
    const centralEntry = Buffer.alloc(46);
    centralEntry.writeUInt32LE(0x02014b50, 0);  // signature
    centralEntry.writeUInt16LE(20, 4);          // version made by
    centralEntry.writeUInt16LE(20, 6);          // version needed
    centralEntry.writeUInt16LE(0, 8);           // flags
    centralEntry.writeUInt16LE(method, 10);     // compression method
    centralEntry.writeUInt16LE(0, 12);          // mod time
    centralEntry.writeUInt16LE(0, 14);          // mod date
    centralEntry.writeUInt32LE(crc, 16);        // crc-32
    centralEntry.writeUInt32LE(storedData.length, 20);       // compressed size
    centralEntry.writeUInt32LE(uncompressedData.length, 24); // uncompressed size
    centralEntry.writeUInt16LE(nameBuffer.length, 28);       // file name length
    centralEntry.writeUInt16LE(0, 30);          // extra field length
    centralEntry.writeUInt16LE(0, 32);          // file comment length
    centralEntry.writeUInt16LE(0, 34);          // disk number start
    centralEntry.writeUInt16LE(0, 36);          // internal file attributes
    centralEntry.writeUInt32LE(0, 38);          // external file attributes
    centralEntry.writeUInt32LE(offset, 42);     // relative offset of local header

    centralEntries.push({ header: centralEntry, name: nameBuffer });

    offset += localHeader.length + nameBuffer.length + storedData.length;
  }

  // Central directory
  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const entry of centralEntries) {
    chunks.push(entry.header, entry.name);
    centralDirSize += entry.header.length + entry.name.length;
  }

  // End of central directory record (22 bytes)
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);   // signature
  endRecord.writeUInt16LE(0, 4);             // disk number
  endRecord.writeUInt16LE(0, 6);             // disk with central dir
  endRecord.writeUInt16LE(files.length, 8);  // entries on this disk
  endRecord.writeUInt16LE(files.length, 10); // total entries
  endRecord.writeUInt32LE(centralDirSize, 12);   // central dir size
  endRecord.writeUInt32LE(centralDirOffset, 16); // central dir offset
  endRecord.writeUInt16LE(0, 20);            // comment length

  chunks.push(endRecord);

  return Buffer.concat(chunks);
}

/**
 * CRC-32 implementation (standard polynomial 0xEDB88320)
 */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ==================== Build Process ====================

console.log('=== Building Klondike Solitaire ===');
console.log(`Build version: ${buildVersion}\n`);

// Clean dist directory
const distDir = join(rootDir, 'dist');
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir, { recursive: true });

// Read index.html template once
const indexHtmlTemplate = readFileSync(join(rootDir, 'index.html'), 'utf8');

let totalSuccess = 0;

for (const platform of platforms) {
  const platformDir = join(distDir, platform);
  console.log(`Building for: ${platform}`);

  // Create platform directory
  mkdirSync(platformDir, { recursive: true });

  const zipFiles = [];
  let fileCount = 0;

  // Copy files
  for (const file of filesToCopy) {
    const src = join(rootDir, file);

    if (!existsSync(src)) {
      console.warn(`  Warning: ${file} not found, skipping`);
      continue;
    }

    const dest = join(platformDir, file);
    mkdirSync(dirname(dest), { recursive: true });

    if (file === 'index.html') {
      // Modify index.html for this platform
      const modified = buildIndexHtml(indexHtmlTemplate, platform);
      writeFileSync(dest, modified, 'utf8');
      zipFiles.push({ name: file, data: Buffer.from(modified, 'utf8') });
    } else {
      cpSync(src, dest);
      zipFiles.push({ name: file.replace(/\\/g, '/'), data: readFileSync(src) });
    }
    fileCount++;
  }

  console.log(`  Copied ${fileCount} files to dist/${platform}/`);

  // Create ZIP
  const zipPath = join(distDir, `${platform}.zip`);
  const zipBuffer = createZipBuffer(zipFiles);
  writeFileSync(zipPath, zipBuffer);

  const zipSizeKB = (zipBuffer.length / 1024).toFixed(1);
  console.log(`  Created ${platform}.zip (${zipSizeKB} KB, ${zipFiles.length} files)`);

  // Validate: check index.html has platform marker
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

if (totalSuccess !== platforms.length) {
  process.exit(1);
}
