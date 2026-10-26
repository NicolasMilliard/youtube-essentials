import { JWT } from 'google-auth-library';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(120_000),
  });
  const body = await response.json();
  if (!response.ok) {
    const reason = body.error?.message || body.error || 'Request failed';
    throw new Error(`${new URL(url).hostname}: HTTP ${response.status}: ${reason}`);
  }
  return body;
}

async function authenticate() {
  const raw = required('CWS_SERVICE_ACCOUNT_JSON');
  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error('CWS_SERVICE_ACCOUNT_JSON must contain the complete JSON key file');
  }
  if (
    credentials?.type !== 'service_account' ||
    typeof credentials.client_email !== 'string' ||
    !credentials.client_email ||
    typeof credentials.private_key !== 'string' ||
    !credentials.private_key
  ) {
    throw new Error('CWS_SERVICE_ACCOUNT_JSON is not a valid service account key');
  }

  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    keyId: credentials.private_key_id,
    scopes: ['https://www.googleapis.com/auth/chromewebstore'],
  });

  let token;
  try {
    token = await client.authorize();
  } catch (error) {
    // Do not print Google's request object: it can contain authentication data.
    const status = error.response?.status || 'unknown';
    throw new Error(
      `Google authentication failed (HTTP ${status}). Check the service account key.`,
    );
  }
  if (!token.access_token) throw new Error('Google returned no access token');
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${token.access_token}`);
  return token.access_token;
}

export async function main(args = process.argv.slice(2)) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--check-auth')) {
    throw new Error('Usage: node scripts/publish-chrome.mjs [--check-auth]');
  }
  const checkAuth = args[0] === '--check-auth';
  const publisher = encodeURIComponent(required('CWS_PUBLISHER_ID'));
  const extensionId = required('CWS_EXTENSION_ID');
  const extension = encodeURIComponent(extensionId);
  const zip = checkAuth ? null : await readFile('artifacts/youtube-essentials-chrome.zip');
  const accessToken = await authenticate();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const item = `publishers/${publisher}/items/${extension}`;
  const origin = 'https://chromewebstore.googleapis.com';
  const api = `${origin}/v2/${item}`;

  if (checkAuth) {
    const status = await request(`${api}:fetchStatus`, { headers });
    if (status.itemId !== extensionId)
      throw new Error('Chrome returned an unexpected extension ID');
    console.log(`Chrome API access verified for ${status.itemId}. No update submitted.`);
    return;
  }

  const upload = await request(`${origin}/upload/v2/${item}:upload`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/zip' },
    body: zip,
  });
  let state = upload.uploadState;
  for (let attempt = 0; state === 'IN_PROGRESS' && attempt < 30; attempt++) {
    await sleep(10_000);
    const status = await request(`${api}:fetchStatus`, { headers });
    state = status.lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED') {
    throw new Error(`Chrome upload did not succeed: ${state}. Check the store dashboard.`);
  }

  const result = await request(`${api}:publish`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  });
  if (!['PENDING_REVIEW', 'PUBLISHED', 'PUBLISHED_TO_TESTERS'].includes(result.state)) {
    throw new Error(`Unexpected Chrome submission state: ${result.state}`);
  }
  console.log(`Chrome submission accepted: ${result.state}`);
  if (result.warningInfo) console.warn(JSON.stringify(result.warningInfo));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
