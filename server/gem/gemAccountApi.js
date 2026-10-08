import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const scrypt = promisify(scryptCallback);
const DB_PATH = resolve(process.env.GEM_ACCOUNT_DB || '.gem-data/gem-accounts.sqlite');
const SESSION_DAYS = 14;
const PLANS = Object.freeze({
  INTELLIGENCE: { monthlyUsd: 0, label: 'Intelligence' },
  TRADING: { monthlyUsd: 299, label: 'Trading' },
  ENTERPRISE: { monthlyUsd: 2499, label: 'Enterprise' },
});

function send(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    const key = part.slice(0, index).trim();
    try { return [key, decodeURIComponent(part.slice(index + 1).trim())]; }
    catch { return [key, '']; }
  }).filter(([key]) => key));
}

function readJson(req, maxBytes = 16_384) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Enter a valid email address'), { statusCode: 400 });
  }
  return email;
}

function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id, email: row.email, fullName: row.full_name,
    organization: row.organization || null, country: row.country || null,
    role: row.role, plan: row.plan, membershipStatus: row.membership_status,
    emailVerified: Boolean(row.email_verified), createdAt: row.created_at,
  };
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function openGemAccountDatabase(path = DB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS gem_users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL, organization TEXT, country TEXT, role TEXT NOT NULL DEFAULT 'MEMBER',
      plan TEXT NOT NULL DEFAULT 'INTELLIGENCE', membership_status TEXT NOT NULL DEFAULT 'ACTIVE',
      email_verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gem_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES gem_users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS gem_sessions_user_idx ON gem_sessions(user_id);
    CREATE TABLE IF NOT EXISTS gem_membership_events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES gem_users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL, plan TEXT, status TEXT NOT NULL, provider_ref TEXT,
      created_at TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS gem_membership_user_idx ON gem_membership_events(user_id, created_at);
  `);
  return db;
}

function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  db.prepare('INSERT INTO gem_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .run(hashToken(token), userId, expires.toISOString(), now.toISOString());
  return { token, expires };
}

function sessionUser(db, req) {
  const token = parseCookies(req.headers.cookie).gem_session;
  if (!token || token.length > 128) return null;
  const row = db.prepare(`SELECT u.* FROM gem_sessions s JOIN gem_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>? AND u.membership_status!='SUSPENDED'`)
    .get(hashToken(token), new Date().toISOString());
  return row || null;
}

function cookie(token, expires, secure) {
  return `gem_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
}

function clearCookie(secure) {
  return `gem_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function createGemAccountApiHandler({ db = null } = {}) {
  const database = db || openGemAccountDatabase();
  const attempts = new Map();
  function rateLimit(req, route) {
    const now = Date.now();
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const key = route + ':' + ip;
    const prior = attempts.get(key) || [];
    const fresh = prior.filter(timestamp => now - timestamp < 15 * 60 * 1000);
    const limit = route === 'login' ? 8 : 12;
    if (fresh.length >= limit) {
      attempts.set(key, fresh);
      throw Object.assign(new Error('Too many attempts. Wait 15 minutes and try again.'), { statusCode: 429 });
    }
    fresh.push(now);
    attempts.set(key, fresh);
    if (attempts.size > 5000) {
      for (const [entry, timestamps] of attempts) {
        if (!timestamps.some(timestamp => now - timestamp < 15 * 60 * 1000)) attempts.delete(entry);
      }
    }
  }
  return async function gemAccountApiHandler(req, res) {
    const url = new URL(req.url || '/', 'http://gem.local');
    if (!url.pathname.startsWith('/api/gem/account')) return false;
    const secure = Boolean(req.socket?.encrypted) || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
    try {
      if (req.method === 'GET' && url.pathname === '/api/gem/account/plans') {
        return send(res, 200, { plans: Object.entries(PLANS).map(([id, value]) => ({ id, ...value })) });
      }
      if (req.method === 'GET' && url.pathname === '/api/gem/account/me') {
        return send(res, 200, { user: safeUser(sessionUser(database, req)) });
      }
      if (req.method === 'POST' && url.pathname === '/api/gem/account/register') {
        rateLimit(req, 'register');
        const body = await readJson(req);
        const email = normalizeEmail(body.email);
        const fullName = String(body.fullName || '').trim();
        const password = String(body.password || '');
        if (fullName.length < 2 || fullName.length > 120) throw Object.assign(new Error('Enter your full name'), { statusCode: 400 });
        if (password.length < 12 || password.length > 256) throw Object.assign(new Error('Use a password of at least 12 characters'), { statusCode: 400 });
        const organization = String(body.organization || '').trim().slice(0, 160) || null;
        const country = String(body.country || '').trim().slice(0, 80) || null;
        const salt = randomBytes(16);
        const derived = await scrypt(password, salt, 64);
        const passwordHash = `scrypt:${salt.toString('hex')}:${Buffer.from(derived).toString('hex')}`;
        const now = new Date().toISOString();
        const id = `usr_${randomBytes(12).toString('hex')}`;
        try {
          database.prepare(`INSERT INTO gem_users(id,email,password_hash,full_name,organization,country,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?)`).run(id, email, passwordHash, fullName, organization, country, now, now);
        } catch (error) {
          if (/UNIQUE constraint failed: gem_users.email/.test(String(error.message))) {
            throw Object.assign(new Error('An account already exists for this email'), { statusCode: 409 });
          }
          throw error;
        }
        database.prepare(`INSERT INTO gem_membership_events(id,user_id,event_type,plan,status,created_at)
          VALUES(?,?,?,?,?,?)`).run(`evt_${randomBytes(10).toString('hex')}`, id, 'ACCOUNT_CREATED', 'INTELLIGENCE', 'ACTIVE', now);
        const session = createSession(database, id);
        const user = database.prepare('SELECT * FROM gem_users WHERE id=?').get(id);
        return send(res, 201, { user: safeUser(user) }, { 'set-cookie': cookie(session.token, session.expires, secure) });
      }
      if (req.method === 'POST' && url.pathname === '/api/gem/account/login') {
        rateLimit(req, 'login');
        const body = await readJson(req);
        const email = normalizeEmail(body.email);
        const password = String(body.password || '');
        const row = database.prepare('SELECT * FROM gem_users WHERE email=?').get(email);
        let valid = false;
        if (row && password.length <= 256) {
          const [scheme, saltHex, hashHex] = row.password_hash.split(':');
          if (scheme === 'scrypt' && saltHex && hashHex) {
            const derived = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64));
            const expected = Buffer.from(hashHex, 'hex');
            valid = derived.length === expected.length && timingSafeEqual(derived, expected);
          }
        }
        if (!valid) throw Object.assign(new Error('Email or password is incorrect'), { statusCode: 401 });
        const session = createSession(database, row.id);
        return send(res, 200, { user: safeUser(row) }, { 'set-cookie': cookie(session.token, session.expires, secure) });
      }
      if (req.method === 'POST' && url.pathname === '/api/gem/account/logout') {
        const token = parseCookies(req.headers.cookie).gem_session;
        if (token) database.prepare('DELETE FROM gem_sessions WHERE token_hash=?').run(hashToken(token));
        return send(res, 200, { ok: true }, { 'set-cookie': clearCookie(secure) });
      }
      if (req.method === 'POST' && url.pathname === '/api/gem/account/membership-request') {
        const user = sessionUser(database, req);
        if (!user) return send(res, 401, { error: 'Sign in to request a membership upgrade' });
        const body = await readJson(req);
        const plan = String(body.plan || '').toUpperCase();
        if (!['TRADING', 'ENTERPRISE'].includes(plan)) throw Object.assign(new Error('Unsupported membership plan'), { statusCode: 400 });
        const now = new Date().toISOString();
        const id = `evt_${randomBytes(10).toString('hex')}`;
        database.prepare(`INSERT INTO gem_membership_events(id,user_id,event_type,plan,status,created_at,metadata_json)
          VALUES(?,?,?,?,?,?,?)`).run(id, user.id, 'UPGRADE_REQUESTED', plan, 'PENDING_PROVIDER_CHECKOUT', now, JSON.stringify({ monthlyUsd: PLANS[plan].monthlyUsd }));
        return send(res, 202, { requestId: id, plan, status: 'PENDING_PROVIDER_CHECKOUT', monthlyUsd: PLANS[plan].monthlyUsd, message: 'Membership request recorded. No payment has been taken and access has not been upgraded.' });
      }
      return send(res, 405, { error: 'Method not allowed' }, { allow: 'GET, POST' });
    } catch (error) {
      const status = Number(error?.statusCode) || 500;
      return send(res, status, { error: status === 500 ? 'Account service error' : String(error.message || error) });
    }
  };
}

export function gemAccountApiPlugin() {
  let handler;
  return {
    name: 'gem-account-api',
    configureServer(server) {
      handler = createGemAccountApiHandler();
      server.middlewares.use((req, res, next) => {
        if (!String(req.url || '').startsWith('/api/gem/account')) return next();
        Promise.resolve(handler(req, res)).catch(() => {
          if (!res.headersSent) send(res, 500, { error: 'Account service error' });
        });
      });
    },
    closeBundle() {},
  };
}
