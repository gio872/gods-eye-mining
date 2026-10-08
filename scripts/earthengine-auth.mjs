#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const python = process.platform === 'win32' ? 'python' : 'python3';
const project = String(process.env.GEM_EARTHENGINE_PROJECT || '').trim();

if (!project) {
  console.error(
    'GEM_EARTHENGINE_PROJECT is not set. Configure the Google Cloud project first.',
  );
  process.exit(1);
}

const probe = spawnSync(
  python,
  ['-c', 'import ee; print("earthengine-api ready")'],
  { stdio: 'inherit' },
);
if (probe.status !== 0) {
  console.error(
    'earthengine-api is missing. Run Pinokio Install again or install it with pip.',
  );
  process.exit(probe.status || 1);
}

const auth = spawnSync(
  python,
  ['-m', 'ee.cli', 'authenticate', '--project', project],
  { stdio: 'inherit' },
);

process.exit(auth.status || 0);
