#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

export function pythonCommand() {
  if (process.platform === 'win32') return 'python';
  return 'python3';
}

export function prepareEarthEngineRuntime() {
  const python = pythonCommand();
  const probe = spawnSync(python, ['--version'], { stdio: 'pipe' });
  if (probe.status !== 0) {
    console.warn('[GEM/GEE] Python not found; Earth Engine gateway remains optional.');
    return { available: false, reason: 'python-missing' };
  }

  const check = spawnSync(
    python,
    ['-c', 'import ee; print(ee.__version__)'],
    { stdio: 'pipe', encoding: 'utf8' },
  );
  if (check.status === 0) {
    console.log('[GEM/GEE] earthengine-api already installed.');
    return { available: true, version: check.stdout.trim() };
  }

  const install = spawnSync(
    python,
    ['-m', 'pip', 'install', '--user', 'earthengine-api'],
    { stdio: 'inherit' },
  );
  if (install.status !== 0) {
    console.warn('[GEM/GEE] Could not install earthengine-api; GEM remains usable.');
    return { available: false, reason: 'install-failed' };
  }

  const verify = spawnSync(
    python,
    ['-c', 'import ee; print(ee.__version__)'],
    { stdio: 'pipe', encoding: 'utf8' },
  );
  if (verify.status !== 0) {
    console.warn('[GEM/GEE] Installed package could not be imported; GEM remains usable.');
    return { available: false, reason: 'import-failed' };
  }

  console.log('[GEM/GEE] earthengine-api ready: '+verify.stdout.trim());
  return { available: true, version: verify.stdout.trim() };
}
