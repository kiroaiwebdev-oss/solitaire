/**
 * Build script: generates per-platform dist/<platform>/ directories.
 * Run with: node tools/build.mjs
 * 
 * Since we have no external dependencies, this simply copies files
 * into platform-specific directories.
 */

import { mkdirSync, cpSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const platforms = ['standalone'];

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
  'src/platform/index.js',
  'src/config/scoring.js',
  'src/config/themes.js',
  'src/config/daily-seeds.js'
];

console.log('=== Building Klondike Solitaire ===\n');

for (const platform of platforms) {
  const distDir = join(rootDir, 'dist', platform);
  console.log(`Building for: ${platform}`);

  // Create dist directory
  mkdirSync(distDir, { recursive: true });

  // Copy files
  for (const file of filesToCopy) {
    const src = join(rootDir, file);
    const dest = join(distDir, file);

    if (!existsSync(src)) {
      console.warn(`  Warning: ${file} not found, skipping`);
      continue;
    }

    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
  }

  console.log(`  Done: dist/${platform}/`);
}

console.log('\nBuild complete!');
