#!/usr/bin/env node
import { realpathSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPinokioEnvironment } from './pinokio-environment.mjs';
import { formatSetupReport, inspectSetup, npmProcessSpec } from './setup-doctor.mjs';

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = realpathSync(path.resolve(path.dirname(MODULE_PATH), '..'));
const READY_FILE = path.join(ROOT, 'pinokio', '.installed');

export function runChecked(command, args, { shell = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: '1' },
    shell,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${command} ${args.join(' ')} exited with code ${result.status}`);
    error.exitCode = result.status || 1;
    throw error;
  }
}

function releaseWindowsNativeLocks() {
  if (process.platform !== 'win32') return;
  // npm ci may need to replace esbuild's native executable. Pinokio/Vite can
  // leave a detached esbuild child alive briefly after the previous session.
  // Killing only esbuild.exe is safe here because this installer itself is
  // running under node.exe.
  spawnSync('taskkill', ['/F', '/T', '/IM', 'esbuild.exe'], {
    cwd: ROOT,
    windowsHide: true,
    stdio: 'ignore',
  });
}

export function installPinokioDependencies() {
  applyPinokioEnvironment();
  rmSync(READY_FILE, { force: true });
  const npm = npmProcessSpec();
  releaseWindowsNativeLocks();

  // npm ci removes the entire node_modules tree before reinstalling. On
  // Windows, Cesium contains a large asset tree that can remain locked by
  // Pinokio, Vite, antivirus, or Explorer and make that cleanup fail with
  // EPERM. A normal npm install reconciles package-lock.json without doing
  // that destructive pre-clean step, so use it for the local Windows runtime.
  const installArgs = process.platform === 'win32'
    ? ['install', '--no-audit', '--no-fund', '--prefer-offline']
    : ['ci', '--no-audit', '--no-fund'];

  try {
    runChecked(npm.command, installArgs, { shell: npm.shell });
  } catch (error) {
    // A native child can still be holding a file. Release the known binary
    // lock and retry once before surfacing the installation failure.
    releaseWindowsNativeLocks();
    if (process.platform === 'win32') {
      const waitUntil = Date.now() + 1500;
      while (Date.now() < waitUntil) {}
    }
    runChecked(npm.command, installArgs, { shell: npm.shell });
  }

  // Pinokio starts Vite directly and loads only its ENVIRONMENT file plus the
  // normal dotenv ladder. Unlike dev-fresh.sh, it does not import macOS
  // Keychain items, so its install report must describe that exact runtime.
  const report = inspectSetup({
    includeKeychain: false,
    // The raw app ENVIRONMENT file was applied above. Even an empty field now
    // shadows Vite's dotenv ladder, so diagnosis must stop there instead of
    // claiming a dotenv-only value will reach the launched app.
    authoritativeEnvironment: true,
  });
  console.log(`\n${formatSetupReport(report, {
    readyMessage: 'Ready. Return to Pinokio and choose Start.',
  })}\n`);
  if (!report.ready) process.exit(1);

  writeFileSync(READY_FILE, `${new Date().toISOString()}\n`, { mode: 0o600 });
  console.log('[Pinokio] Installation ready.');
}

export function isDirectInvocation(
  invokedPath = process.argv[1],
  modulePath = MODULE_PATH,
) {
  if (typeof invokedPath !== 'string' || invokedPath.length === 0) return false;
  if (typeof modulePath !== 'string' || modulePath.length === 0) return false;
  try {
    return realpathSync(path.resolve(invokedPath)) === realpathSync(path.resolve(modulePath));
  } catch {
    return path.resolve(invokedPath) === path.resolve(modulePath);
  }
}

if (isDirectInvocation()) {
  try {
    installPinokioDependencies();
  } catch (error) {
    console.error(`[Pinokio] Installation failed: ${error?.message || String(error)}`);
    process.exit(error?.exitCode || 1);
  }
}
