import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { createGemAccountApiHandler, openGemAccountDatabase } from './gemAccountApi.js';

function request(handler, method, url, body = {}, cookie = '') {
  return new Promise((resolve, reject) => {
    const req = new PassThrough();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json', cookie };
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
    const result = await request(handler, 'POST', '/api/gem/account/membership-request', { plan: 'TRADING' }, cookie);
    assert.equal(result.status, 202);
    assert.equal(result.body.status, 'PENDING_PROVIDER_CHECKOUT');
    const me = await request(handler, 'GET', '/api/gem/account/me', {}, cookie);
    assert.equal(me.body.user.plan, 'INTELLIGENCE');
  } finally { db.close(); }
});
