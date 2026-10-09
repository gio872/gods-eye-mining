import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createHmac } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGemAccountApiHandler, openGemAccountDatabase } from './gemAccountApi.js';

function request(handler, method, url, body = {}, cookie = '', extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = new PassThrough();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json', cookie, ...extraHeaders };
    req.socket = { remoteAddress: '127.0.0.1', encrypted: false };
    const headers = {};
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(name, value) { headers[name.toLowerCase()] = value; },
      end(payload) {
        this.headersSent = true;
        try { resolve({ status: this.statusCode, headers, body: JSON.parse(payload) }); }
        catch (error) { reject(error); }
      },
    };
    const result = handler(req, res);
    Promise.resolve(result).catch(reject);
    if (method === 'GET') req.end();
    else req.end(JSON.stringify(body));
  });
}

test('GEM account registration creates a member and an HttpOnly session', async () => {
  const db = openGemAccountDatabase(':memory:');
  try {
    const handler = createGemAccountApiHandler({ db });
    const result = await request(handler, 'POST', '/api/gem/account/register', {
      fullName: 'Test Member', email: 'member@example.com', password: 'secure-password-123',
      organization: 'Example Mining', country: 'Colombia',
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.email, 'member@example.com');
    assert.equal(result.body.user.plan, 'INTELLIGENCE');
    assert.equal(result.body.user.emailVerified, false);
    assert.equal(typeof result.body.developmentVerificationToken, 'string');
    assert.equal(result.body.user.role, 'MEMBER');
    assert.match(result.headers['set-cookie'], /HttpOnly/);
    assert.doesNotMatch(JSON.stringify(result.body), /password_hash|secure-password/);
  } finally { db.close(); }
});

test('GEM account API rejects weak passwords and duplicate emails', async () => {
  const db = openGemAccountDatabase(':memory:');
  try {
    const handler = createGemAccountApiHandler({ db });
    const weak = await request(handler, 'POST', '/api/gem/account/register', {
      fullName: 'Test Member', email: 'member@example.com', password: 'weak',
    });
    assert.equal(weak.status, 400);
    const first = await request(handler, 'POST', '/api/gem/account/register', {
      fullName: 'Test Member', email: 'member@example.com', password: 'secure-password-123',
    });
    assert.equal(first.status, 201);
    const duplicate = await request(handler, 'POST', '/api/gem/account/register', {
      fullName: 'Other Member', email: 'MEMBER@example.com', password: 'secure-password-456',
    });
    assert.equal(duplicate.status, 409);
  } finally { db.close(); }
});

test('GEM membership upgrades remain pending and do not grant paid access', async () => {
  const db = openGemAccountDatabase(':memory:');
  try {
    const handler = createGemAccountApiHandler({ db });
    const registered = await request(handler, 'POST', '/api/gem/account/register', {
      fullName: 'Test Member', email: 'member@example.com', password: 'secure-password-123',
    });
    const cookie = registered.headers['set-cookie'].split(';')[0];
    const verified = await request(handler, 'GET', '/api/gem/account/verify-email?token=' + encodeURIComponent(registered.body.developmentVerificationToken));
    assert.equal(verified.status, 200);
    const result = await request(handler, 'POST', '/api/gem/account/membership-request', { plan: 'TRADING' }, cookie);
    assert.equal(result.status, 202);
    assert.equal(result.body.status, 'PENDING_PROVIDER_CHECKOUT');
    const me = await request(handler, 'GET', '/api/gem/account/me', {}, cookie);
    assert.equal(me.body.user.plan, 'INTELLIGENCE');
  } finally { db.close(); }
});


test('Mining Participants profiles are tenant-scoped and role-controlled', async () => {
  const db = openGemAccountDatabase(':memory:');
  try {
    const handler = createGemAccountApiHandler({ db });
    const register = async (email) => {
      const created = await request(handler, 'POST', '/api/gem/account/register', {
        fullName: 'Participant User', email, password: 'secure-password-123',
      });
      assert.equal(created.status, 201);
      await request(handler, 'GET', '/api/gem/account/verify-email?token=' + encodeURIComponent(created.body.developmentVerificationToken));
      return { id: created.body.user.id, cookie: created.headers['set-cookie'].split(';')[0] };
    };
    const owner = await register('owner@example.com');
    const viewer = await register('viewer@example.com');
    const created = await request(handler, 'POST', '/api/gem/account/organizations', {
      legalName: 'Andes Mineral SAS', displayName: 'Andes Mineral', participantType: 'MINER',
      country: 'Colombia', registrationNumber: 'NIT-TEST-123', commodities: ['gold', 'copper'],
    }, owner.cookie);
    assert.equal(created.status, 201);
    assert.equal(created.body.organization.kybStatus, 'NOT_SUBMITTED');
    const orgId = created.body.organization.id;

    const invite = await request(handler, 'POST', '/api/gem/account/organizations/' + orgId + '/members',
      { email: 'viewer@example.com', role: 'VIEWER' }, owner.cookie);
    assert.equal(invite.status, 201);
    assert.equal(invite.body.member.role, 'VIEWER');

    const viewerDetail = await request(handler, 'GET', '/api/gem/account/organizations/' + orgId, {}, viewer.cookie);
    assert.equal(viewerDetail.status, 200);
    assert.equal(viewerDetail.body.organization.legalName, 'Andes Mineral SAS');
    assert.deepEqual(viewerDetail.body.members, []);
    assert.deepEqual(viewerDetail.body.evidence, []);

    const forbiddenPatch = await request(handler, 'PATCH', '/api/gem/account/organizations/' + orgId,
      { displayName: 'Unauthorized change' }, viewer.cookie);
    assert.equal(forbiddenPatch.status, 403);

    const outsiders = await register('outsider@example.com');
    const hidden = await request(handler, 'GET', '/api/gem/account/organizations/' + orgId, {}, outsiders.cookie);
    assert.equal(hidden.status, 404);
  } finally { db.close(); }
});

test('KYB uploads are private, hash-checked and require reviewed evidence before VERIFIED', async () => {
  const db = openGemAccountDatabase(':memory:');
  const priorStorage = process.env.GEM_PRIVATE_DOCUMENTS_DIR;
  const priorReviewKey = process.env.GEM_KYB_REVIEW_KEY;
  const storage = await mkdtemp(join(tmpdir(), 'gem-kyb-test-'));
  process.env.GEM_PRIVATE_DOCUMENTS_DIR = storage;
  process.env.GEM_KYB_REVIEW_KEY = 'test-review-key-is-long-enough-32bytes';
  try {
    const handler = createGemAccountApiHandler({ db });
    const registered = await request(handler, 'POST', '/api/gem/account/register', {
      fullName: 'KYB Owner', email: 'kyb-owner@example.com', password: 'secure-password-123',
    });
    const cookie = registered.headers['set-cookie'].split(';')[0];
    await request(handler, 'GET', '/api/gem/account/verify-email?token=' + encodeURIComponent(registered.body.developmentVerificationToken));
    const created = await request(handler, 'POST', '/api/gem/account/organizations', {
      legalName: 'Test Resource Company', participantType: 'PRODUCER', country: 'Colombia',
    }, cookie);
    const orgId = created.body.organization.id;
    const evidenceIds = [];
    for (const evidenceType of ['COMPANY_REGISTRATION', 'TAX_REGISTRATION', 'OWNERSHIP_DECLARATION']) {
      const upload = await request(handler, 'POST', '/api/gem/account/organizations/' + orgId + '/evidence', {
        evidenceType, title: evidenceType, fileName: 'document.pdf', mimeType: 'application/pdf',
        contentBase64: Buffer.from('%PDF-1.4\nGEM fixture').toString('base64'), notes: 'test only',
      }, cookie);
      assert.equal(upload.status, 201);
      evidenceIds.push(upload.body.evidence.id);
      assert.equal(upload.body.evidence.status, 'SUBMITTED');
      const stored = await stat(join(storage, orgId, upload.body.evidence.id ? (db.prepare('SELECT document_ref FROM gem_participant_evidence WHERE id=?').get(upload.body.evidence.id).document_ref.split('/').pop()) : 'missing'));
      assert.equal((stored.mode & 0o777), 0o600);
    }
    const before = await request(handler, 'GET', '/api/gem/account/organizations/' + orgId, {}, cookie);
    assert.equal(before.body.organization.kybStatus, 'UNDER_REVIEW');
    for (const id of evidenceIds) {
      const reviewed = await request(handler, 'POST', '/api/gem/account/review/evidence/' + id,
        { decision: 'APPROVED', note: 'Fixture review' }, '', { 'x-gem-review-key': process.env.GEM_KYB_REVIEW_KEY });
      assert.equal(reviewed.status, 200);
    }
    const after = await request(handler, 'GET', '/api/gem/account/organizations/' + orgId, {}, cookie);
    assert.equal(after.body.organization.kybStatus, 'VERIFIED');
  } finally {
    db.close();
    await rm(storage, { recursive: true, force: true });
    if (priorStorage === undefined) delete process.env.GEM_PRIVATE_DOCUMENTS_DIR; else process.env.GEM_PRIVATE_DOCUMENTS_DIR = priorStorage;
    if (priorReviewKey === undefined) delete process.env.GEM_KYB_REVIEW_KEY; else process.env.GEM_KYB_REVIEW_KEY = priorReviewKey;
  }
});

test('VIP access is granted only by an authenticated, idempotent subscription webhook', async () => {
  const db = openGemAccountDatabase(':memory:');
  const priorSecret = process.env.GEM_PAYMENT_WEBHOOK_SECRET;
  process.env.GEM_PAYMENT_WEBHOOK_SECRET = 'test-payment-secret-with-at-least-32-bytes';
  try {
    const handler = createGemAccountApiHandler({ db });
    const registered = await request(handler, 'POST', '/api/gem/account/register', {
      fullName: 'VIP Subscriber', email: 'vip@example.com', password: 'secure-password-123',
    });
    const cookie = registered.headers['set-cookie'].split(';')[0];
    await request(handler, 'GET', '/api/gem/account/verify-email?token=' + encodeURIComponent(registered.body.developmentVerificationToken));
    const pending = await request(handler, 'POST', '/api/gem/account/membership-request', { plan: 'TRADING' }, cookie);
    assert.equal(pending.status, 202);
    const before = await request(handler, 'GET', '/api/gem/account/entitlements', {}, cookie);
    assert.equal(before.body.plan, 'INTELLIGENCE');
    assert.equal(before.body.capabilities.marketplace, false);

    const event = {
      id: 'evt_subscription_active_test', type: 'subscription.activated', provider: 'CUSTOM',
      data: { object: { id: 'sub_test_1', userId: registered.body.user.id, plan: 'TRADING',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(), status: 'active' } },
    };
    const raw = JSON.stringify(event);
    const signature = createHmac('sha256', process.env.GEM_PAYMENT_WEBHOOK_SECRET).update(raw).digest('hex');
    const headers = { 'x-gem-payment-signature': 'sha256=' + signature };
    const activated = await request(handler, 'POST', '/api/gem/account/billing/webhook', event, '', headers);
    assert.equal(activated.status, 200);
    const after = await request(handler, 'GET', '/api/gem/account/entitlements', {}, cookie);
    assert.equal(after.body.plan, 'TRADING');
    assert.equal(after.body.capabilities.marketplace, true);
    const duplicate = await request(handler, 'POST', '/api/gem/account/billing/webhook', event, '', headers);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.duplicate, true);
  } finally {
    db.close();
    if (priorSecret === undefined) delete process.env.GEM_PAYMENT_WEBHOOK_SECRET; else process.env.GEM_PAYMENT_WEBHOOK_SECRET = priorSecret;
  }
});
