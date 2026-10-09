import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
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
    CREATE TABLE IF NOT EXISTS gem_organizations (
      id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, display_name TEXT NOT NULL,
      registration_number TEXT, participant_type TEXT NOT NULL, country TEXT NOT NULL,
      region TEXT, website TEXT, commodities_json TEXT NOT NULL DEFAULT '[]',
      description TEXT, kyb_status TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
      status TEXT NOT NULL DEFAULT 'ACTIVE', created_by TEXT NOT NULL REFERENCES gem_users(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS gem_org_country_idx ON gem_organizations(country, participant_type);
    CREATE TABLE IF NOT EXISTS gem_organization_members (
      organization_id TEXT NOT NULL REFERENCES gem_organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES gem_users(id) ON DELETE CASCADE,
      role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE', invited_by TEXT REFERENCES gem_users(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(organization_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS gem_org_members_user_idx ON gem_organization_members(user_id,status);
    CREATE TABLE IF NOT EXISTS gem_participant_evidence (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES gem_organizations(id) ON DELETE CASCADE,
      submitted_by TEXT NOT NULL REFERENCES gem_users(id), evidence_type TEXT NOT NULL,
      title TEXT NOT NULL, document_ref TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL, checksum_sha256 TEXT NOT NULL,
      notes TEXT, status TEXT NOT NULL DEFAULT 'SUBMITTED',
      reviewed_by TEXT, review_note TEXT, submitted_at TEXT NOT NULL, reviewed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS gem_participant_evidence_org_idx ON gem_participant_evidence(organization_id,status);
    CREATE TABLE IF NOT EXISTS gem_subscriptions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES gem_users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL, provider TEXT NOT NULL, provider_subscription_id TEXT NOT NULL,
      status TEXT NOT NULL, current_period_end TEXT, updated_at TEXT NOT NULL,
      UNIQUE(provider,provider_subscription_id)
    );
    CREATE INDEX IF NOT EXISTS gem_subscription_user_idx ON gem_subscriptions(user_id,status);
    CREATE TABLE IF NOT EXISTS gem_payment_events (
      provider TEXT NOT NULL, event_id TEXT NOT NULL, event_type TEXT NOT NULL,
      processed_at TEXT NOT NULL, payload_sha256 TEXT NOT NULL,
      PRIMARY KEY(provider,event_id)
    );
    CREATE TABLE IF NOT EXISTS gem_email_tokens (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES gem_users(id) ON DELETE CASCADE,
      token_type TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS gem_email_tokens_user_idx ON gem_email_tokens(user_id,token_type,expires_at);
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


const PARTICIPANT_TYPES = Object.freeze(['MINER','MINE_OPERATOR','MINE','TRADER','COMMODITY_TRADER','OFFTAKER','PRODUCER']);
const ORG_ROLES = Object.freeze(['OWNER','ADMIN','ANALYST','TRADER','VIEWER']);
const EVIDENCE_TYPES = Object.freeze(['COMPANY_REGISTRATION','TAX_REGISTRATION','OWNERSHIP_DECLARATION','OPERATING_LICENSE','PROOF_OF_ADDRESS','PRODUCT_ASSAY','OTHER']);
const REQUIRED_KYB_EVIDENCE = ['COMPANY_REGISTRATION','TAX_REGISTRATION','OWNERSHIP_DECLARATION'];
const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;
function randomId(prefix) { return prefix + randomBytes(12).toString('hex'); }
function normalizeText(value, max, label, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw Object.assign(new Error(label + ' is required'), { statusCode: 400 });
  if (text.length > max) throw Object.assign(new Error(label + ' is too long'), { statusCode: 400 });
  return text || null;
}
function jsonArray(value, maxItems = 40) {
  if (value == null || value === '') return [];
  if (!Array.isArray(value) || value.length > maxItems) throw Object.assign(new Error('Expected a valid list of values'), { statusCode: 400 });
  return [...new Set(value.map(item => String(item).trim()).filter(Boolean))].slice(0, maxItems);
}
function safeOrganization(row) {
  if (!row) return null;
  return { id:row.id,legalName:row.legal_name,displayName:row.display_name,registrationNumber:row.registration_number||null,
    participantType:row.participant_type,country:row.country,region:row.region||null,website:row.website||null,
    commodities:JSON.parse(row.commodities_json||'[]'),description:row.description||null,kybStatus:row.kyb_status,
    status:row.status,createdAt:row.created_at,updatedAt:row.updated_at };
}
function organizationRole(db, userId, organizationId) {
  return db.prepare('SELECT role,status FROM gem_organization_members WHERE organization_id=? AND user_id=?').get(organizationId,userId)||null;
}
function requireOrgRole(db,user,organizationId,roles=ORG_ROLES) {
  const membership=organizationRole(db,user.id,organizationId);
  if(!membership||membership.status!=='ACTIVE') throw Object.assign(new Error('Organization not found or access denied'),{statusCode:404});
  if(!roles.includes(membership.role)) throw Object.assign(new Error('Your organization role does not allow this action'),{statusCode:403});
  return membership;
}
function verifiedOrgStatus(db,organizationId) {
  const rows=db.prepare('SELECT evidence_type,status FROM gem_participant_evidence WHERE organization_id=?').all(organizationId);
  const approved=new Set(rows.filter(row=>row.status==='APPROVED').map(row=>row.evidence_type));
  const complete=REQUIRED_KYB_EVIDENCE.every(type=>approved.has(type));
  const rejected=rows.some(row=>row.status==='REJECTED');
  const status=complete?'VERIFIED':rows.length?(rejected?'ACTION_REQUIRED':'UNDER_REVIEW'):'NOT_SUBMITTED';
  db.prepare('UPDATE gem_organizations SET kyb_status=?,updated_at=? WHERE id=?').run(status,new Date().toISOString(),organizationId);
  return status;
}
function safeEvidence(row) {
  return {id:row.id,organizationId:row.organization_id,evidenceType:row.evidence_type,title:row.title,
    fileName:row.file_name,mimeType:row.mime_type,sizeBytes:row.size_bytes,checksumSha256:row.checksum_sha256,
    notes:row.notes||null,status:row.status,reviewNote:row.review_note||null,submittedAt:row.submitted_at,reviewedAt:row.reviewed_at||null};
}
function readRawBody(req,maxBytes=64*1024) {
  return new Promise((resolveBody,reject)=>{
    let size=0,ended=false;const chunks=[];
    req.on('data',chunk=>{if(ended)return;size+=chunk.length;if(size>maxBytes){ended=true;reject(Object.assign(new Error('Request body too large'),{statusCode:413}));req.resume();return;}chunks.push(chunk);});
    req.on('end',()=>{if(!ended)resolveBody(Buffer.concat(chunks));});
    req.on('error',error=>{if(!ended)reject(error);});
  });
}
function readJsonMax(req,maxBytes) {
  return readRawBody(req,maxBytes).then(raw=>{try{return JSON.parse(raw.toString('utf8')||'{}');}catch{throw Object.assign(new Error('Invalid JSON body'),{statusCode:400});}});
}
function verifyHmac(secret,raw,supplied) {
  if(!secret||Buffer.byteLength(secret)<32) throw Object.assign(new Error('Payment webhook is not configured'),{statusCode:503});
  const signature=String(supplied||'').replace(/^sha256=/i,'').trim();
  if(!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected=createHmac('sha256',secret).update(raw).digest(),actual=Buffer.from(signature,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
function requireReviewSecret(req) {
  const secret=process.env.GEM_KYB_REVIEW_KEY||'',supplied=String(req.headers['x-gem-review-key']||'');
  if(!secret||Buffer.byteLength(secret)<32) throw Object.assign(new Error('KYB review service is not configured'),{statusCode:503});
  const expected=Buffer.from(secret),actual=Buffer.from(supplied);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected)) throw Object.assign(new Error('Review authorization failed'),{statusCode:401});
}
function validOrganizationId(id) { return /^org_[a-f0-9]{24}$/.test(String(id)); }

function getMembershipEntitlements(db,user) {
  const now=new Date().toISOString();
  const active=db.prepare("SELECT plan FROM gem_subscriptions WHERE user_id=? AND status='ACTIVE' AND (current_period_end IS NULL OR current_period_end>?)").all(user.id,now);
  const plans=[...new Set(active.map(row=>row.plan))];
  const rank={INTELLIGENCE:0,TRADING:1,ENTERPRISE:2};
  let plan='INTELLIGENCE';
  for(const candidate of plans) if((rank[candidate]??0)>(rank[plan]??0)) plan=candidate;
  // A paid plan in the user row alone is never enough: it needs an active subscription record.
  const caps={
    intelligence:true, miningParticipants:true, participantKybSubmission:true,
    marketplace:plan==='TRADING'||plan==='ENTERPRISE',
    verifiedCounterpartyWorkflows:plan==='TRADING'||plan==='ENTERPRISE',
    multiUserOrganization:plan==='ENTERPRISE',
    privateApi:plan==='ENTERPRISE',
    advancedDueDiligence:plan==='ENTERPRISE',
    capitalMatching:plan==='ENTERPRISE',
  };
  return {plan,capabilities:caps,subscriptionStatus:plan==='INTELLIGENCE'?'FREE': 'ACTIVE'};
}

function requireVerifiedUser(user) {
  if (!user?.email_verified) throw Object.assign(new Error('Verify your email before using this feature'), { statusCode: 403, code: 'EMAIL_VERIFICATION_REQUIRED' });
}
function createEmailToken(db,userId,type) {
  const token=randomBytes(32).toString('base64url'),now=new Date(),expires=new Date(now.getTime()+30*60*1000);
  db.prepare('INSERT INTO gem_email_tokens(token_hash,user_id,token_type,expires_at,created_at) VALUES(?,?,?,?,?)')
    .run(hashToken(token),userId,type,expires.toISOString(),now.toISOString());
  return {token,expires};
}
async function deliverAccountEmail(to,type,token) {
  const endpoint=process.env.GEM_EMAIL_DELIVERY_URL||'',apiKey=process.env.GEM_EMAIL_DELIVERY_TOKEN||'';
  const publicBase=String(process.env.GEM_PUBLIC_BASE_URL||'').replace(/\/$/,'');
  if(!endpoint||!apiKey||!publicBase)return false;
  const verifyUrl=publicBase+'/api/gem/account/verify-email?token='+encodeURIComponent(token);
  const response=await fetch(endpoint,{
    method:'POST',headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},
    body:JSON.stringify({
      to,template:type==='EMAIL_VERIFY'?'gem-account-verification':'gem-password-reset',
      token,verificationUrl:type==='EMAIL_VERIFY'?verifyUrl:null,expiresMinutes:30
    })
  });
  return response.ok;
}
function safePaymentEvent(event) {
  if(!event||typeof event!=='object'||typeof event.id!=='string'||typeof event.type!=='string') throw Object.assign(new Error('Webhook event must include id and type'),{statusCode:400});
  const object=event.data?.object||event.data||{};
  return {id:event.id.slice(0,200),type:event.type,provider:String(event.provider||'SIGNED_PROVIDER').slice(0,80),
    userId:String(object.userId||object.user_id||object.metadata?.gemUserId||event.userId||''),
    plan:String(object.plan||object.metadata?.gemPlan||event.plan||'').toUpperCase(),
    subscriptionId:String(object.subscriptionId||object.subscription_id||object.id||''),
    periodEnd:object.currentPeriodEnd||object.current_period_end||null,status:String(object.status||event.status||'').toLowerCase()};
}
export function createGemAccountApiHandler({ db = null } = {}) {
  const database = db || openGemAccountDatabase();
  const attempts = new Map();
  function rateLimit(req, route) {
    const now = Date.now();
    const forwarded = process.env.GEM_TRUST_PROXY === 'true' ? req.headers['x-forwarded-for'] : '';
    const ip = String(forwarded || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const key = route + ':' + ip;
    const prior = attempts.get(key) || [];
    const fresh = prior.filter(timestamp => now - timestamp < 15 * 60 * 1000);
    const limit = route === 'login' ? 8 : route === 'reset' ? 5 : 12;
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

      if(req.method==='GET'&&url.pathname==='/api/gem/account/verify-email'){
        const token=String(url.searchParams.get('token')||'');
        if(!/^[A-Za-z0-9_-]{32,100}$/.test(token))return send(res,400,{error:'Email verification token is invalid'});
        const tokenRow=database.prepare("SELECT * FROM gem_email_tokens WHERE token_hash=? AND token_type='EMAIL_VERIFY' AND used_at IS NULL AND expires_at>?").get(hashToken(token),new Date().toISOString());
        if(!tokenRow)return send(res,400,{error:'Verification token is invalid or expired. Request a new verification email.'});
        const now=new Date().toISOString();
        database.exec('BEGIN IMMEDIATE');
        try{
          database.prepare('UPDATE gem_email_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL').run(now,hashToken(token));
          database.prepare('UPDATE gem_users SET email_verified=1,updated_at=? WHERE id=?').run(now,tokenRow.user_id);
          database.prepare("INSERT INTO gem_membership_events(id,user_id,event_type,plan,status,created_at) VALUES(?,?,?,?,?,?)")
            .run(randomId('evt_'),tokenRow.user_id,'EMAIL_VERIFIED','INTELLIGENCE','ACTIVE',now);
          database.exec('COMMIT');
        }catch(error){database.exec('ROLLBACK');throw error;}
        return send(res,200,{verified:true,message:'Email verified. You can now create a Mining Participants profile and request membership upgrades.'});
      }
      if(req.method==='POST'&&url.pathname==='/api/gem/account/password-reset/request'){
        rateLimit(req,'reset');
        const body=await readJson(req);
        let email;
        try{email=normalizeEmail(body.email);}catch{return send(res,200,{message:'If an account exists, password reset instructions will be sent.'});}
        const row=database.prepare('SELECT id,email FROM gem_users WHERE email=?').get(email);
        let developmentResetToken=null;
        if(row){
          const now=new Date().toISOString();
          database.prepare("UPDATE gem_email_tokens SET used_at=? WHERE user_id=? AND token_type='PASSWORD_RESET' AND used_at IS NULL").run(now,row.id);
          const created=createEmailToken(database,row.id,'PASSWORD_RESET');
          try{await deliverAccountEmail(email,'PASSWORD_RESET',created.token);}catch{}
          if(process.env.NODE_ENV!=='production')developmentResetToken=created.token;
        }
        const payload={message:'If an account exists, password reset instructions will be sent.'};
        if(developmentResetToken)payload.developmentResetToken=developmentResetToken;
        return send(res,200,payload);
      }
      if(req.method==='POST'&&url.pathname==='/api/gem/account/password-reset/confirm'){
        const body=await readJson(req),token=String(body.token||''),password=String(body.password||'');
        if(!/^[A-Za-z0-9_-]{32,100}$/.test(token))throw Object.assign(new Error('Reset token is invalid'),{statusCode:400});
        if(password.length<12||password.length>256)throw Object.assign(new Error('Use a password of at least 12 characters'),{statusCode:400});
        const row=database.prepare("SELECT * FROM gem_email_tokens WHERE token_hash=? AND token_type='PASSWORD_RESET' AND used_at IS NULL AND expires_at>?").get(hashToken(token),new Date().toISOString());
        if(!row)throw Object.assign(new Error('Reset token is invalid or expired'),{statusCode:400});
        const salt=randomBytes(16),derived=Buffer.from(await scrypt(password,salt,64));
        const passwordHash='scrypt:'+salt.toString('hex')+':'+derived.toString('hex'),now=new Date().toISOString();
        database.exec('BEGIN IMMEDIATE');
        try{
          database.prepare('UPDATE gem_users SET password_hash=?,updated_at=? WHERE id=?').run(passwordHash,now,row.user_id);
          database.prepare('UPDATE gem_email_tokens SET used_at=? WHERE token_hash=?').run(now,hashToken(token));
          database.prepare('DELETE FROM gem_sessions WHERE user_id=?').run(row.user_id);
          database.prepare("INSERT INTO gem_membership_events(id,user_id,event_type,status,created_at) VALUES(?,?,?,?,?)")
            .run(randomId('evt_'),row.user_id,'PASSWORD_RESET','COMPLETED',now);
          database.exec('COMMIT');
        }catch(error){database.exec('ROLLBACK');throw error;}
        return send(res,200,{ok:true,message:'Password reset completed. Sign in with your new password.'});
      }

      if (req.method === 'GET' && url.pathname === '/api/gem/account/plans') {
        return send(res, 200, { plans: Object.entries(PLANS).map(([id, value]) => ({ id, ...value })) });
      }
      if (req.method === 'GET' && url.pathname === '/api/gem/account/me') {
        const row=sessionUser(database,req);
        return send(res,200,{user:row?{...safeUser(row),...getMembershipEntitlements(database,row)}:null});
      }
      if (req.method === 'GET' && url.pathname === '/api/gem/account/entitlements') {
        const row=sessionUser(database,req);
        if(!row)return send(res,401,{error:'Sign in to inspect GEM membership entitlements'});
        return send(res,200,{user:safeUser(row),...getMembershipEntitlements(database,row)});
      }

      if (req.method === 'POST' && url.pathname === '/api/gem/account/organizations') {
        const user = sessionUser(database, req);
        if (!user) return send(res, 401, { error: 'Sign in to create a participant profile' });
        requireVerifiedUser(user);
        const body = await readJson(req);
        const legalName = normalizeText(body.legalName, 180, 'Legal company name', true);
        const displayName = normalizeText(body.displayName || legalName, 180, 'Display name', true);
        const participantType = String(body.participantType || '').toUpperCase();
        if (!PARTICIPANT_TYPES.includes(participantType)) throw Object.assign(new Error('Choose a valid mining participant type'), { statusCode: 400 });
        const country = normalizeText(body.country, 80, 'Country', true);
        const website = normalizeText(body.website, 240, 'Website');
        if (website) { let parsed; try { parsed = new URL(website); } catch { throw Object.assign(new Error('Website must be a valid URL'), { statusCode: 400 }); } if (!['http:','https:'].includes(parsed.protocol)) throw Object.assign(new Error('Website must use HTTP or HTTPS'), { statusCode: 400 }); }
        const registrationNumber = normalizeText(body.registrationNumber, 100, 'Registration number');
        const region = normalizeText(body.region, 100, 'Region');
        const description = normalizeText(body.description, 2000, 'Description');
        const commodities = jsonArray(body.commodities);
        const now = new Date().toISOString(), id = randomId('org_');
        database.exec('BEGIN IMMEDIATE');
        try {
          database.prepare('INSERT INTO gem_organizations(id,legal_name,display_name,registration_number,participant_type,country,region,website,commodities_json,description,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .run(id,legalName,displayName,registrationNumber,participantType,country,region,website,JSON.stringify(commodities),description,user.id,now,now);
          database.prepare('INSERT INTO gem_organization_members(organization_id,user_id,role,status,invited_by,created_at,updated_at) VALUES(?,?,? ,\'ACTIVE\',?,?,?)')
            .run(id,user.id,'OWNER',user.id,now,now);
          database.prepare("INSERT INTO gem_membership_events(id,user_id,event_type,status,created_at,metadata_json) VALUES(?,?,?,?,?,?)")
            .run(randomId('evt_'),user.id,'PARTICIPANT_PROFILE_CREATED','ACTIVE',now,JSON.stringify({organizationId:id,participantType}));
          database.exec('COMMIT');
        } catch (error) { database.exec('ROLLBACK'); throw error; }
        return send(res,201,{organization:safeOrganization(database.prepare('SELECT * FROM gem_organizations WHERE id=?').get(id)),role:'OWNER'});
      }
      if (req.method === 'GET' && url.pathname === '/api/gem/account/organizations') {
        const user = sessionUser(database, req);
        if (!user) return send(res,401,{error:'Sign in to view participant profiles'});
        const rows=database.prepare('SELECT o.*,m.role FROM gem_organizations o JOIN gem_organization_members m ON m.organization_id=o.id WHERE m.user_id=? AND m.status=\'ACTIVE\' ORDER BY o.created_at DESC').all(user.id);
        return send(res,200,{organizations:rows.map(row=>({...safeOrganization(row),role:row.role}))});
      }
      const organizationMatch = url.pathname.match(/^\/api\/gem\/account\/organizations\/([^/]+)(?:\/(members|evidence))?$/);
      if (organizationMatch) {
        const user=sessionUser(database,req);
        if (!user) return send(res,401,{error:'Sign in to access participant profiles'});
        const organizationId=organizationMatch[1], subresource=organizationMatch[2]||null;
        if (!validOrganizationId(organizationId)) return send(res,404,{error:'Organization not found'});
        if (!subresource && req.method==='GET') {
          requireOrgRole(database,user,organizationId);
          const org=database.prepare('SELECT * FROM gem_organizations WHERE id=?').get(organizationId);
          const membership=organizationRole(database,user.id,organizationId);
          const canManageMembers=['OWNER','ADMIN'].includes(membership?.role);
          const canViewEvidence=['OWNER','ADMIN','ANALYST'].includes(membership?.role);
          const members=canManageMembers?database.prepare('SELECT u.id,u.email,u.full_name,m.role,m.status,m.created_at FROM gem_organization_members m JOIN gem_users u ON u.id=m.user_id WHERE m.organization_id=? ORDER BY m.created_at').all(organizationId):[];
          const evidence=canViewEvidence?database.prepare('SELECT * FROM gem_participant_evidence WHERE organization_id=? ORDER BY submitted_at DESC').all(organizationId):[];
          return send(res,200,{organization:safeOrganization(org),members:members.map(m=>({userId:m.id,email:m.email,fullName:m.full_name,role:m.role,status:m.status,joinedAt:m.created_at})),evidence:evidence.map(safeEvidence)});
        }
        if (!subresource && req.method==='PATCH') {
          requireOrgRole(database,user,organizationId,['OWNER','ADMIN']);
          const old=database.prepare('SELECT * FROM gem_organizations WHERE id=?').get(organizationId);
          if(!old) return send(res,404,{error:'Organization not found'});
          const body=await readJson(req);
          const legalName=body.legalName===undefined?old.legal_name:normalizeText(body.legalName,180,'Legal company name',true);
          const displayName=body.displayName===undefined?old.display_name:normalizeText(body.displayName,180,'Display name',true);
          const participantType=body.participantType===undefined?old.participant_type:String(body.participantType).toUpperCase();
          if(!PARTICIPANT_TYPES.includes(participantType)) throw Object.assign(new Error('Choose a valid mining participant type'),{statusCode:400});
          const country=body.country===undefined?old.country:normalizeText(body.country,80,'Country',true);
          const registrationNumber=body.registrationNumber===undefined?old.registration_number:normalizeText(body.registrationNumber,100,'Registration number');
          const region=body.region===undefined?old.region:normalizeText(body.region,100,'Region');
          const website=body.website===undefined?old.website:normalizeText(body.website,240,'Website');
          if(website){let parsed;try{parsed=new URL(website);}catch{throw Object.assign(new Error('Website must be a valid URL'),{statusCode:400});}if(!['http:','https:'].includes(parsed.protocol))throw Object.assign(new Error('Website must use HTTP or HTTPS'),{statusCode:400});}
          const description=body.description===undefined?old.description:normalizeText(body.description,2000,'Description');
          const commodities=body.commodities===undefined?JSON.parse(old.commodities_json||'[]'):jsonArray(body.commodities);
          database.prepare('UPDATE gem_organizations SET legal_name=?,display_name=?,registration_number=?,participant_type=?,country=?,region=?,website=?,commodities_json=?,description=?,updated_at=? WHERE id=?')
            .run(legalName,displayName,registrationNumber,participantType,country,region,website,JSON.stringify(commodities),description,new Date().toISOString(),organizationId);
          return send(res,200,{organization:safeOrganization(database.prepare('SELECT * FROM gem_organizations WHERE id=?').get(organizationId))});
        }
        if(subresource==='members' && req.method==='POST'){
          requireOrgRole(database,user,organizationId,['OWNER','ADMIN']);
          requireVerifiedUser(user);
          const body=await readJson(req),email=normalizeEmail(body.email),role=String(body.role||'VIEWER').toUpperCase();
          if(!ORG_ROLES.filter(r=>r!=='OWNER').includes(role)) throw Object.assign(new Error('Invalid organization role'),{statusCode:400});
          const target=database.prepare('SELECT id,email_verified FROM gem_users WHERE email=?').get(email);
          if(!target) throw Object.assign(new Error('The invited user must create a GEM account first'),{statusCode:404});
          if(!target.email_verified) throw Object.assign(new Error('The invited user must verify their email before joining an organization'),{statusCode:409});
          const existing=organizationRole(database,target.id,organizationId);
          if(existing?.role==='OWNER') throw Object.assign(new Error('The organization owner role cannot be reassigned'),{statusCode:409});
          const now=new Date().toISOString();
          database.prepare("INSERT INTO gem_organization_members(organization_id,user_id,role,status,invited_by,created_at,updated_at) VALUES(?,?,?,'ACTIVE',?,?,?) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=excluded.role,status='ACTIVE',invited_by=excluded.invited_by,updated_at=excluded.updated_at")
            .run(organizationId,target.id,role,user.id,now,now);
          return send(res,201,{member:{userId:target.id,email,role,status:'ACTIVE'},message:'Existing GEM user added to this organization.'});
        }
        if(subresource==='evidence' && req.method==='GET'){
          requireOrgRole(database,user,organizationId,['OWNER','ADMIN','ANALYST']);
          const rows=database.prepare('SELECT * FROM gem_participant_evidence WHERE organization_id=? ORDER BY submitted_at DESC').all(organizationId);
          return send(res,200,{evidence:rows.map(safeEvidence)});
        }
        if(subresource==='evidence' && req.method==='POST'){
          requireOrgRole(database,user,organizationId,['OWNER','ADMIN','ANALYST']);
          requireVerifiedUser(user);
          const body=await readJsonMax(req,Math.ceil(MAX_EVIDENCE_BYTES*1.42)+20000);
          const evidenceType=String(body.evidenceType||'').toUpperCase();
          if(!EVIDENCE_TYPES.includes(evidenceType)) throw Object.assign(new Error('Invalid evidence type'),{statusCode:400});
          const title=normalizeText(body.title,180,'Document title',true);
          const fileName=normalizeText(body.fileName,180,'File name',true);
          const notes=normalizeText(body.notes,1000,'Notes');
          const mimeType=String(body.mimeType||'').toLowerCase();
          const mimeMap={'application/pdf':{ext:'pdf',valid:b=>b.length>=5&&b.subarray(0,5).toString()==='%PDF-'},'image/png':{ext:'png',valid:b=>b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},'image/jpeg':{ext:'jpg',valid:b=>b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255}};
          const kind=mimeMap[mimeType];
          if(!kind) throw Object.assign(new Error('Upload a PDF, PNG or JPEG file'),{statusCode:400});
          const encoded=String(body.contentBase64||'');
          if(!encoded||encoded.length>Math.ceil(MAX_EVIDENCE_BYTES*1.42)||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw Object.assign(new Error('File is empty or exceeds the 8 MB limit'),{statusCode:413});
          const bytes=Buffer.from(encoded,'base64');
          if(!bytes.length||bytes.length>MAX_EVIDENCE_BYTES||!kind.valid(bytes)) throw Object.assign(new Error('File content does not match its declared PDF, PNG or JPEG type'),{statusCode:400});
          const storageName=randomId('doc_')+'.'+kind.ext;
          const base=resolve(process.env.GEM_PRIVATE_DOCUMENTS_DIR||'.gem-data/private-documents');
          const folder=resolve(base,organizationId);
          if(!folder.startsWith(base+ '/')) throw Object.assign(new Error('Invalid private storage path'),{statusCode:400});
          mkdirSync(folder,{recursive:true,mode:0o700});
          const filePath=resolve(folder,storageName);
          await writeFile(filePath,bytes,{flag:'wx',mode:0o600});
          const id=randomId('ev_'),now=new Date().toISOString(),checksum=createHash('sha256').update(bytes).digest('hex');
          try{
            database.prepare("INSERT INTO gem_participant_evidence(id,organization_id,submitted_by,evidence_type,title,document_ref,file_name,mime_type,size_bytes,checksum_sha256,notes,status,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'SUBMITTED',?)")
              .run(id,organizationId,user.id,evidenceType,title,'kyb/'+organizationId+'/'+storageName,fileName,mimeType,bytes.length,checksum,notes,now);
            database.prepare('UPDATE gem_organizations SET kyb_status=\'UNDER_REVIEW\',updated_at=? WHERE id=?').run(now,organizationId);
          }catch(error){await unlink(filePath).catch(()=>{});throw error;}
          return send(res,201,{evidence:{id,evidenceType,title,fileName,mimeType,sizeBytes:bytes.length,checksumSha256:checksum,status:'SUBMITTED',submittedAt:now},message:'Document saved in private server-side storage and queued for review.'});
        }
        return send(res,405,{error:'Method not allowed'},{allow:'GET, POST, PATCH'});
      }
      const memberDelete = url.pathname.match(/^\/api\/gem\/account\/organizations\/(org_[a-f0-9]{24})\/members\/([^/]+)$/);
      if(memberDelete&&req.method==='DELETE'){
        const user=sessionUser(database,req);
        if(!user)return send(res,401,{error:'Sign in to manage organization members'});
        requireOrgRole(database,user,memberDelete[1],['OWNER','ADMIN']);
        const targetId=decodeURIComponent(memberDelete[2]);
        const target=organizationRole(database,targetId,memberDelete[1]);
        if(!target)return send(res,404,{error:'Organization member not found'});
        if(target.role==='OWNER')throw Object.assign(new Error('The owner cannot be removed; transfer ownership through a controlled administrator workflow'),{statusCode:409});
        database.prepare('DELETE FROM gem_organization_members WHERE organization_id=? AND user_id=?').run(memberDelete[1],targetId);
        return send(res,200,{ok:true});
      }
      const evidenceDownload = url.pathname.match(/^\/api\/gem\/account\/organizations\/(org_[a-f0-9]{24})\/evidence\/(ev_[a-f0-9]{24})\/download$/);
      if(evidenceDownload&&req.method==='GET'){
        const user=sessionUser(database,req);
        if(!user)return send(res,401,{error:'Sign in to download participant evidence'});
        requireOrgRole(database,user,evidenceDownload[1],['OWNER','ADMIN','ANALYST']);
        const row=database.prepare('SELECT * FROM gem_participant_evidence WHERE id=? AND organization_id=?').get(evidenceDownload[2],evidenceDownload[1]);
        if(!row)return send(res,404,{error:'Evidence not found'});
        const match=String(row.document_ref).match(/^kyb\/(org_[a-f0-9]{24})\/(doc_[a-f0-9]{24}\.(?:pdf|png|jpg))$/);
        if(!match||match[1]!==evidenceDownload[1])return send(res,500,{error:'Private evidence storage reference is invalid'});
        const base=resolve(process.env.GEM_PRIVATE_DOCUMENTS_DIR||'.gem-data/private-documents');
        const filePath=resolve(base,match[1],match[2]);
        if(!filePath.startsWith(base+'/'))return send(res,500,{error:'Private evidence storage path is invalid'});
        const bytes=await readFile(filePath);
        if(createHash('sha256').update(bytes).digest('hex')!==row.checksum_sha256)return send(res,409,{error:'Evidence integrity check failed'});
        res.statusCode=200;res.setHeader('content-type',row.mime_type);res.setHeader('content-length',String(bytes.length));
        res.setHeader('content-disposition','attachment; filename="GEM-evidence-'+row.id+'.'+(row.mime_type==='application/pdf'?'pdf':row.mime_type==='image/png'?'png':'jpg')+'"');
        res.setHeader('cache-control','private, no-store');res.setHeader('x-content-type-options','nosniff');res.end(bytes);return;
      }
      const reviewMatch=url.pathname.match(/^\/api\/gem\/account\/review\/evidence\/(ev_[a-f0-9]{24})$/);
      if(reviewMatch&&req.method==='POST'){
        requireReviewSecret(req);
        const body=await readJson(req),decision=String(body.decision||'').toUpperCase();
        if(!['APPROVED','REJECTED'].includes(decision))throw Object.assign(new Error('Decision must be APPROVED or REJECTED'),{statusCode:400});
        const note=normalizeText(body.note,800,'Review note');
        const row=database.prepare('SELECT * FROM gem_participant_evidence WHERE id=?').get(reviewMatch[1]);
        if(!row)return send(res,404,{error:'Evidence not found'});
        const now=new Date().toISOString();
        database.prepare('UPDATE gem_participant_evidence SET status=?,reviewed_by=?,review_note=?,reviewed_at=? WHERE id=?').run(decision,'GEM_KYB_REVIEW_OPERATOR',note,now,row.id);
        const kybStatus=verifiedOrgStatus(database,row.organization_id);
        database.prepare("INSERT INTO gem_membership_events(id,user_id,event_type,status,created_at,metadata_json) VALUES(?,?,?,?,?,?)")
          .run(randomId('evt_'),row.submitted_by,'KYB_EVIDENCE_REVIEWED',decision,now,JSON.stringify({organizationId:row.organization_id,evidenceId:row.id,kybStatus}));
        return send(res,200,{evidence:{id:row.id,status:decision,reviewNote:note,reviewedAt:now},kybStatus});
      }
      if(req.method==='POST'&&url.pathname==='/api/gem/account/billing/webhook'){
        const raw=await readRawBody(req,128*1024);
        if(!verifyHmac(process.env.GEM_PAYMENT_WEBHOOK_SECRET||'',raw,req.headers['x-gem-payment-signature']))return send(res,401,{error:'Payment webhook signature is invalid'});
        const rawEvent=JSON.parse(raw.toString('utf8')||'{}'),event=safePaymentEvent(rawEvent);
        const acceptedTypes=['subscription.activated','subscription.updated','subscription.cancelled','subscription.payment_failed'];
        if(!acceptedTypes.includes(event.type))return send(res,202,{received:true,ignored:true,reason:'Unsupported event type'});
        if(!event.subscriptionId||event.subscriptionId.length>250)throw Object.assign(new Error('Subscription identifier is required'),{statusCode:400});
        if(['subscription.activated','subscription.updated'].includes(event.type)){
          if(!['TRADING','ENTERPRISE'].includes(event.plan)||!event.userId)throw Object.assign(new Error('Active subscription events require a valid GEM user ID and plan'),{statusCode:400});
          if(event.status&&event.status!=='active'&&event.status!=='trialing')throw Object.assign(new Error('Subscription status is not active'),{statusCode:400});
          if(event.periodEnd&&!Number.isFinite(Date.parse(event.periodEnd)))throw Object.assign(new Error('Subscription period end is invalid'),{statusCode:400});
        }
        const now=new Date().toISOString(),payloadHash=createHash('sha256').update(raw).digest('hex');
        database.exec('BEGIN IMMEDIATE');
        try{
          const inserted=database.prepare('INSERT OR IGNORE INTO gem_payment_events(provider,event_id,event_type,processed_at,payload_sha256) VALUES(?,?,?,?,?)')
            .run(event.provider,event.id,event.type,now,payloadHash);
          if(!inserted.changes){database.exec('COMMIT');return send(res,200,{received:true,duplicate:true});}
          let existing=database.prepare('SELECT * FROM gem_subscriptions WHERE provider=? AND provider_subscription_id=?').get(event.provider,event.subscriptionId);
          if(['subscription.cancelled','subscription.payment_failed'].includes(event.type)&&!existing) throw Object.assign(new Error('Cannot change membership for an unknown subscription'),{statusCode:404});
          const userId=event.userId||existing?.user_id;
          if(!userId)throw Object.assign(new Error('Subscription event does not identify a GEM account'),{statusCode:400});
          const user=database.prepare('SELECT id,plan FROM gem_users WHERE id=?').get(userId);
          if(!user)throw Object.assign(new Error('Subscription references an unknown GEM account'),{statusCode:404});
          if(existing&&existing.user_id!==userId)throw Object.assign(new Error('Subscription is already linked to a different GEM account'),{statusCode:409});
          if(['subscription.activated','subscription.updated'].includes(event.type)){
            const id=existing?.id||randomId('sub_');
            database.prepare("INSERT INTO gem_subscriptions(id,user_id,plan,provider,provider_subscription_id,status,current_period_end,updated_at) VALUES(?,?,?,?,?,'ACTIVE',?,?) ON CONFLICT(provider,provider_subscription_id) DO UPDATE SET plan=excluded.plan,status='ACTIVE',current_period_end=excluded.current_period_end,updated_at=excluded.updated_at")
              .run(id,userId,event.plan,event.provider,event.subscriptionId,event.periodEnd?new Date(event.periodEnd).toISOString():null,now);
            database.prepare("UPDATE gem_users SET plan=?,membership_status='ACTIVE',updated_at=? WHERE id=?").run(event.plan,now,userId);
            database.prepare("INSERT INTO gem_membership_events(id,user_id,event_type,plan,status,provider_ref,created_at,metadata_json) VALUES(?,?,?,?,?,?,?,?)")
              .run(randomId('evt_'),userId,'SUBSCRIPTION_CONFIRMED',event.plan,'ACTIVE',event.subscriptionId,now,JSON.stringify({provider:event.provider,providerEventId:event.id}));
          }else{
            if(existing)database.prepare("UPDATE gem_subscriptions SET status=?,updated_at=? WHERE provider=? AND provider_subscription_id=?")
              .run(event.type==='subscription.cancelled'?'CANCELLED':'PAST_DUE',now,event.provider,event.subscriptionId);
            const stillActive=database.prepare("SELECT 1 AS active FROM gem_subscriptions WHERE user_id=? AND status='ACTIVE' AND (current_period_end IS NULL OR current_period_end>?) LIMIT 1").get(userId,now);
            if(!stillActive)database.prepare("UPDATE gem_users SET plan='INTELLIGENCE',updated_at=? WHERE id=?").run(now,userId);
            database.prepare("INSERT INTO gem_membership_events(id,user_id,event_type,plan,status,provider_ref,created_at,metadata_json) VALUES(?,?,?,?,?,?,?,?)")
              .run(randomId('evt_'),userId,event.type.toUpperCase().replaceAll('.','_'),null,event.type==='subscription.cancelled'?'CANCELLED':'PAST_DUE',event.subscriptionId,now,JSON.stringify({provider:event.provider,providerEventId:event.id}));
          }
          database.exec('COMMIT');
        }catch(error){database.exec('ROLLBACK');throw error;}
        return send(res,200,{received:true,processed:true});
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
        const verification=createEmailToken(database,id,'EMAIL_VERIFY');
        let emailDelivered=false;
        try{emailDelivered=await deliverAccountEmail(email,'EMAIL_VERIFY',verification.token);}catch{}
        const session = createSession(database, id);
        const user = database.prepare('SELECT * FROM gem_users WHERE id=?').get(id);
        const payload={user:safeUser(user),verificationRequired:true,emailDeliveryConfigured:emailDelivered};
        if(process.env.NODE_ENV!=='production'&&!emailDelivered)payload.developmentVerificationToken=verification.token;
        return send(res, 201, payload, { 'set-cookie': cookie(session.token, session.expires, secure) });
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
        requireVerifiedUser(user);
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
