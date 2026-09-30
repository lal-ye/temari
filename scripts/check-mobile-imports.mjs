import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Web-retirement plan §4, PR A guard: apps/mobile must import sibling
// workspaces by name (@temari/*), never by a relative path escaping the
// workspace root. "../../" bypasses the package exports seal and breaks when
// the web tree is deleted. Runs in CI (and in the PR A/B gate list).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileRoot = path.join(repoRoot, 'apps/mobile');
const offenders = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) scan(full);
  }
}

function scan(file) {
  const source = fs.readFileSync(file, 'utf8');
  const specifiers = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"](\.[^'"]*)['"]/g;
  for (const match of source.matchAll(specifiers)) {
    // *.json is static data (the reader kitchen-sink fixture), not a
    // workspace module: no exports seal is bypassed, so it stays exempt.
    if (match[1].startsWith('../..') && !match[1].endsWith('.json')) {
      offenders.push(`${path.relative(repoRoot, file)}: ${match[1]}`);
    }
  }
}

walk(mobileRoot);

if (offenders.length) {
  console.error('Mobile import guard: relative imports escaping apps/mobile:');
  for (const offender of offenders) console.error(`  ${offender}`);
  console.error('Import @temari/* by workspace name instead.');
  process.exit(1);
}
console.log('Mobile import guard: no ../../ specifiers escape apps/mobile.');
