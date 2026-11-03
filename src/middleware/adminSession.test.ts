/**
 * Coupon-portal admin sessions replace the browser-held service token.
 * Run: node --require ts-node/register/transpile-only --test src/middleware/adminSession.test.ts
 */
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:1/test';
process.env.SERVICE_AUTH_TOKEN = 'test-service-token-not-a-real-secret';
process.env.LOG_LEVEL = 'error';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_SESSION_TTL_MS,
  adminSessionAuthMiddleware,
  issueAdminSessionToken,
  serviceOrAdminAuthMiddleware,
  verifyAdminSessionToken,
} from './adminSession';

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

function runMiddleware(mw: any, headers: Record<string, string>) {
  const req: any = { headers, url: '/x', method: 'GET' };
  const res = fakeRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
}

test('login-issued admin session token verifies and expires', () => {
  const now = Date.now();
  const { token, expiresAt } = issueAdminSessionToken({ username: 'ops', role: 'ADMIN' }, now);
  assert.equal(verifyAdminSessionToken(token, now)?.username, 'ops');
  assert.equal(Date.parse(expiresAt), now + ADMIN_SESSION_TTL_MS);
  assert.equal(verifyAdminSessionToken(token, now + ADMIN_SESSION_TTL_MS + 1), null);
});

test('tampered or forged admin session tokens are rejected', () => {
  const { token } = issueAdminSessionToken({ username: 'ops' });
  const [, signature] = token.split('.');
  const forgedPayload = Buffer.from(
    JSON.stringify({ username: 'attacker', role: 'ADMIN', exp: Date.now() + 60_000 }),
  ).toString('base64url');
  assert.equal(verifyAdminSessionToken(`${forgedPayload}.${signature}`), null);
  assert.equal(verifyAdminSessionToken('not-a-session'), null);
  assert.equal(verifyAdminSessionToken(process.env.SERVICE_AUTH_TOKEN as string), null);
});

test('coupon admin routes accept an admin session or a backend service token', () => {
  const { token } = issueAdminSessionToken({ username: 'ops' });
  const viaSession = runMiddleware(serviceOrAdminAuthMiddleware, { authorization: `Bearer ${token}` });
  assert.equal(viaSession.nextCalled, true);
  assert.equal(viaSession.req.adminSession.username, 'ops');

  const viaService = runMiddleware(serviceOrAdminAuthMiddleware, {
    'x-service-auth': process.env.SERVICE_AUTH_TOKEN as string,
  });
  assert.equal(viaService.nextCalled, true);

  const anonymous = runMiddleware(serviceOrAdminAuthMiddleware, { 'x-user-id': 'coupon-portal' });
  assert.equal(anonymous.nextCalled, false);
  assert.equal(anonymous.res.statusCode, 401);
});

test('catalog admin proxy accepts an admin session or a backend service token', () => {
  const bearerService = runMiddleware(adminSessionAuthMiddleware, {
    authorization: `Bearer ${process.env.SERVICE_AUTH_TOKEN}`,
  });
  assert.equal(bearerService.nextCalled, false);
  assert.equal(bearerService.res.statusCode, 401);

  const headerService = runMiddleware(adminSessionAuthMiddleware, {
    'x-service-auth': process.env.SERVICE_AUTH_TOKEN as string,
  });
  assert.equal(headerService.nextCalled, false);

  const { token } = issueAdminSessionToken({ username: 'ops' });
  assert.equal(
    runMiddleware(serviceOrAdminAuthMiddleware, {
      'x-service-auth': process.env.SERVICE_AUTH_TOKEN as string,
    }).nextCalled,
    true,
  );
  const viaAdminSession = runMiddleware(serviceOrAdminAuthMiddleware, { authorization: `Bearer ${token}` });
  assert.equal(viaAdminSession.nextCalled, true);
  assert.equal(viaAdminSession.req.adminSession.username, 'ops');
  assert.equal(runMiddleware(adminSessionAuthMiddleware, { authorization: `Bearer ${token}` }).nextCalled, true);
});
