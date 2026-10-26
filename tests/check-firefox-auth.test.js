import { expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { checkFirefoxAccess } from '../scripts/check-firefox-auth.mjs';

const credentials = {
  issuer: 'user:123:456',
  secret: 'test-only-secret',
  extensionId: 'extension@example.com',
};
const endpoint = 'https://addons.mozilla.org/api/v5/addons/addon/';

test('Firefox access uses signed, read-only requests and follows account pagination', async () => {
  const requests = [];
  const claims = [];
  await checkFirefoxAccess({
    ...credentials,
    fetchImpl: async (url, options) => {
      requests.push(url);
      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
      expect(options.redirect).toBe('error');
      expect(options.headers.Authorization).toStartWith('JWT ');
      const [header, payload, signature] = options.headers.Authorization.slice(4).split('.');
      expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
        alg: 'HS256',
        typ: 'JWT',
      });
      expect(signature).toBe(
        createHmac('sha256', credentials.secret).update(`${header}.${payload}`).digest('base64url'),
      );
      const claim = JSON.parse(Buffer.from(payload, 'base64url').toString());
      claims.push(claim);
      expect(claim.iss).toBe(credentials.issuer);
      expect(claim.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
      expect(claim.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(claim.exp - claim.iat).toBeLessThanOrEqual(300);
      expect(claim.jti).toBeTruthy();
      return Response.json(
        requests.length === 1
          ? { results: [{ guid: 'another@example.com' }], next: `${endpoint}?page=2` }
          : { results: [{ guid: credentials.extensionId }], next: null },
      );
    },
  });
  expect(requests).toEqual([endpoint, `${endpoint}?page=2`]);
  expect(claims[0].jti).not.toBe(claims[1].jti);
});

test.each([401, 403, 429, 500])(
  'Firefox access fails on HTTP %i without leaking secrets',
  async (status) => {
    const result = checkFirefoxAccess({
      ...credentials,
      fetchImpl: async () => new Response(credentials.secret, { status }),
    });
    await expect(result).rejects.toThrow(`HTTP ${status}`);
    await expect(result).rejects.not.toThrow(credentials.secret);
  },
);

test('valid credentials for an unrelated account do not pass the Firefox check', async () => {
  await expect(
    checkFirefoxAccess({
      ...credentials,
      fetchImpl: async () =>
        Response.json({ results: [{ guid: 'another@example.com' }], next: null }),
    }),
  ).rejects.toThrow('does not list extension@example.com');
});

test.each([
  ['issuer', 'Missing AMO_JWT_ISSUER'],
  ['secret', 'Missing AMO_JWT_SECRET'],
  ['extensionId', 'browser_specific_settings.gecko.id'],
])('missing %s fails before any request', async (field, message) => {
  let requests = 0;
  await expect(
    checkFirefoxAccess({
      ...credentials,
      [field]: undefined,
      fetchImpl: async () => {
        requests++;
        throw new Error('Unexpected request');
      },
    }),
  ).rejects.toThrow(message);
  expect(requests).toBe(0);
});

test.each([
  'https://example.com/api/v5/addons/addon/?page=2',
  'https://addons.mozilla.org/api/v5/accounts/profile/',
  endpoint,
])('pagination cannot send credentials elsewhere or loop: %s', async (next) => {
  let requests = 0;
  await expect(
    checkFirefoxAccess({
      ...credentials,
      fetchImpl: async () => {
        requests++;
        return Response.json({ results: [], next });
      },
    }),
  ).rejects.toThrow('unexpected pagination URL');
  expect(requests).toBe(1);
});

test.each([{}, { results: [] }, { results: null, next: null }])(
  'malformed Mozilla responses fail closed: %j',
  async (body) => {
    await expect(
      checkFirefoxAccess({
        ...credentials,
        fetchImpl: async () => Response.json(body),
      }),
    ).rejects.toThrow('unexpected add-on list');
  },
);
