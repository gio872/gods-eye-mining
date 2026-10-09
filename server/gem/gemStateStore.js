import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

const ROOT = process.env.GEM_STATE_DIR || '.gem-state';
const SNAPSHOT = join(ROOT, 'targets.json');
const AUDIT = join(ROOT, 'audit.jsonl');

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function ensureStore() {
  await mkdir(ROOT, { recursive: true });
}

async function atomicWrite(path, value) {
  const tmp = path + '.tmp-' + process.pid;
  await writeFile(tmp, JSON.stringify(value), 'utf8');
  await rename(tmp, path);
}

export async function loadTargetState() {
  await ensureStore();
  try {
    return JSON.parse(await readFile(SNAPSHOT, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 1, updatedAt: null, targets: [] };
    throw error;
  }
}

export async function saveTargetState(targets, metadata = {}) {
  await ensureStore();
  const previous = await loadTargetState();
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    runId: metadata.runId || null,
    modelVersion: metadata.modelVersion || null,
    featureVersion: metadata.featureVersion || null,
    provenance: metadata.provenance || [],
    targets: Array.isArray(targets) ? targets : [],
  };
  await atomicWrite(SNAPSHOT, payload);

  const audit = {
    ts: payload.updatedAt,
    event: 'TARGET_STATE_SAVED',
    runId: payload.runId,
    modelVersion: payload.modelVersion,
    featureVersion: payload.featureVersion,
    targetCount: payload.targets.length,
    previousDigest: digest(previous),
    stateDigest: digest(payload),
  };
  const existing = await readFile(AUDIT, 'utf8').catch(() => '');
  await writeFile(AUDIT, existing + JSON.stringify(audit) + '\n', 'utf8');
  return payload;
}

export async function createRunRecord(input = {}) {
  return {
    runId: input.runId || 'gem-' + Date.now().toString(36),
    startedAt: new Date().toISOString(),
    modelVersion: input.modelVersion || null,
    featureVersion: input.featureVersion || null,
    sourceVersions: input.sourceVersions || {},
    provenance: input.provenance || [],
  };
}

export function stateStorePaths() {
  return Object.freeze({ root: ROOT, snapshot: SNAPSHOT, audit: AUDIT });
}
