/**
 * Import check: dynamically imports EVERY *.js file under src/ through the
 * real ES module loader. This catches link-time syntax errors (like an
 * unescaped apostrophe terminating a string) that static-import test suites
 * miss because they never reference the offending module.
 *
 * Reusable: exports checkAllImports() so other suites can run it.
 * Standalone: `env -u NODE_OPTIONS node tests/import-check.mjs`
 *
 * NOTE: must be run with `env -u NODE_OPTIONS node ...` due to the sandbox
 * NODE_OPTIONS preload gotcha.
 */

import { readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SRC_DIR = join(__dirname, '..', 'src');

/**
 * Recursively collect all .js files under a directory.
 * @param {string} dir
 * @returns {string[]} absolute file paths, sorted
 */
export function collectJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.endsWith('.js')) {
      out.push(full);
    }
  }
  return out.sort();
}

/**
 * Import every .js file under srcDir. Returns a result object.
 * @param {string} [srcDir]
 * @returns {Promise<{ checked: number, failures: Array<{file: string, error: string}> }>}
 */
export async function checkAllImports(srcDir = SRC_DIR) {
  const files = collectJsFiles(srcDir);
  const failures = [];
  let checked = 0;

  for (const file of files) {
    checked++;
    const rel = relative(join(srcDir, '..'), file);
    try {
      // Unique query string defeats the module cache so a fresh parse happens.
      await import(pathToFileURL(file).href + `?importcheck=${checked}`);
    } catch (e) {
      failures.push({ file: rel, error: e && e.message ? e.message : String(e) });
    }
  }

  return { checked, failures, files };
}

// --- Standalone runner ---
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  // Minimal browser-ish globals so modules that touch window at import time
  // (none currently should, but be safe) don't crash the parser check.
  globalThis.window = globalThis.window || { location: { search: '' }, addEventListener() {}, removeEventListener() {} };
  globalThis.document = globalThis.document || { addEventListener() {}, getElementById() { return null; }, createElement() { return { getContext() { return null; }, style: {} }; } };

  console.log('=== ES Module Import Check (every file under src/) ===\n');
  const { checked, failures, files } = await checkAllImports();
  for (const f of files) {
    const rel = f.split('/src/').pop();
    const failed = failures.find(x => x.file.endsWith(rel));
    console.log(`  ${failed ? 'FAIL' : 'OK  '}  src/${rel}`);
  }
  console.log(`\n=== Results: ${checked - failures.length}/${checked} modules imported cleanly ===`);
  if (failures.length > 0) {
    console.error('\nImport failures:');
    for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
    process.exit(1);
  } else {
    console.log('All modules parsed and linked successfully!');
  }
}
