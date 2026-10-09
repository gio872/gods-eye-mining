#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

const ROOT = process.cwd();
const environmentPath = path.join(ROOT, 'pinokio', 'ENVIRONMENT');
const python = process.platform === 'win32' ? 'python' : 'python3';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

try {
  let project = String(process.env.GEM_EARTHENGINE_PROJECT || '').trim();
  if (!project) {
    project = String(
      await rl.question('Google Cloud / Earth Engine project ID: '),
    ).trim();
  }
  if (!project) throw new Error('A Google Cloud project ID is required.');

  const existing = existsSync(environmentPath)
    ? readFileSync(environmentPath, 'utf8')
    : '';
  const line = /^GEM_EARTHENGINE_PROJECT=.*$/m;
  const source = line.test(existing)
    ? existing.replace(line, 'GEM_EARTHENGINE_PROJECT=' + project)
    : existing +
      (existing.endsWith('\n') || existing.length === 0 ? '' : '\n') +
      'GEM_EARTHENGINE_PROJECT=' +
      project +
      '\n';
  writeFileSync(environmentPath, source, { mode: 0o600 });

  const probe = spawnSync(
    python,
    ['-c', 'import ee; print("earthengine-api ready")'],
    { stdio: 'inherit' },
  );
  if (probe.status !== 0) {
    throw new Error(
      'earthengine-api is not installed. Run Pinokio Repair/Install first.',
    );
  }

  const auth = spawnSync(
    python,
    ['-m', 'ee.cli', 'authenticate', '--project', project],
    { stdio: 'inherit' },
  );
  if (auth.status !== 0)
    process.exit(auth.status || 1);

  console.log(
    '\nGEE authentication completed. Stop and Start GEM so the GEE gateway starts.\n',
  );
} finally {
  rl.close();
}
