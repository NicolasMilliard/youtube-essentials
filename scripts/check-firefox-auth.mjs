import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const addonsUrl = new URL('https://addons.mozilla.org/api/v5/addons/addon/');

function createToken(issuer, secret) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  // Mozilla's external API requires an HS256 JWT with a short expiry and unique ID.
  // https://mozilla.github.io/addons-server/topics/api/auth.html
  const message = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: issuer,
    jti: randomUUID(),
    iat: issuedAt,
    exp: issuedAt + 60,
  })}`;
  return `${message}.${createHmac('sha256', secret).update(message).digest('base64url')}`;
}

export async function checkFirefoxAccess({ issuer, secret, extensionId, fetchImpl = fetch }) {
  if (!issuer) throw new Error('Missing AMO_JWT_ISSUER (WEB_EXT_API_KEY)');
  if (!secret) throw new Error('Missing AMO_JWT_SECRET (WEB_EXT_API_SECRET)');
  if (typeof extensionId !== 'string' || !extensionId.trim()) {
    throw new Error('The Firefox package must contain browser_specific_settings.gecko.id');
  }

  // The authenticated list contains this account's add-ons, including unlisted authors.
  // A public add-on detail request alone would not establish access to the extension.
  let url = addonsUrl;
  const visited = new Set();
  while (url) {
    if (
      url.origin !== addonsUrl.origin ||
      url.pathname !== addonsUrl.pathname ||
      url.username ||
      url.password ||
      visited.has(url.href)
    ) {
      throw new Error('Mozilla returned an unexpected pagination URL');
    }
    visited.add(url.href);
    const token = createToken(issuer, secret);
    if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${token}`);
    const response = await fetchImpl(url.href, {
      method: 'GET',
      headers: { Authorization: `JWT ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      // Avoid printing response bodies or request headers containing authentication data.
      const hint =
        response.status === 401 || response.status === 403
          ? 'Check AMO_JWT_ISSUER, AMO_JWT_SECRET, and the Mozilla account permissions.'
          : 'Retry the check or inspect the Mozilla developer dashboard.';
      throw new Error(`Mozilla access check failed (HTTP ${response.status}). ${hint}`);
    }
    const page = await response.json();
    if (
      !Array.isArray(page?.results) ||
      !(page.next === null || (typeof page.next === 'string' && page.next.length > 0))
    ) {
      throw new Error('Mozilla returned an unexpected add-on list');
    }
    if (page.results.some((addon) => addon?.guid === extensionId)) return;
    url = page.next === null ? null : new URL(page.next, addonsUrl);
  }
  throw new Error(
    `The authenticated Mozilla account does not list ${extensionId} among its add-ons. ` +
      'Check the API credentials and the Firefox manifest ID.',
  );
}

export async function main() {
  const manifest = JSON.parse(await readFile('dist/firefox/manifest.json', 'utf8'));
  const extensionId = manifest.browser_specific_settings?.gecko?.id;
  await checkFirefoxAccess({
    issuer: process.env.WEB_EXT_API_KEY,
    secret: process.env.WEB_EXT_API_SECRET,
    extensionId,
  });
  console.log(`Firefox API access verified for ${extensionId}. No update submitted by this check.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
