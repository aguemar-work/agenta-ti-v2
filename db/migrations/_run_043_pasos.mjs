import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../..');
const raw = readFileSync(join(dir, '043_workspace_foundation.sql'), 'utf8');
const body = raw.slice(raw.indexOf('BEGIN;') + 6, raw.indexOf('COMMIT;')).trim();
const markers = [...body.matchAll(/^-- =+\n-- PASO (\d+)/gm)];
const chunks = [];

for (let i = 0; i < markers.length; i++) {
  const start = markers[i].index;
  const end = i + 1 < markers.length ? markers[i + 1].index : body.length;
  chunks.push({ paso: markers[i][1], sql: body.slice(start, end).trim() });
}

for (const c of chunks) {
  const f = join(tmpdir(), `043_paso_${c.paso}.sql`);
  writeFileSync(f, c.sql, 'utf8');
  process.stdout.write(`\n>>> PASO ${c.paso} (${c.sql.length} chars)\n`);
  const sql = readFileSync(f, 'utf8');
  const r = spawnSync('npx.cmd', ['@insforge/cli', 'db', 'query', sql], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    windowsHide: true,
  });
  if (r.error) process.stderr.write(String(r.error) + '\n');
  try { unlinkSync(f); } catch { /* ignore */ }
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    process.stderr.write(`>>> FAILED PASO ${c.paso}\n`);
    process.exit(1);
  }
  process.stdout.write(`>>> OK PASO ${c.paso}\n`);
}

process.stdout.write('\nAll PASO chunks OK\n');
