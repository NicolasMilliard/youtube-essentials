import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

const workflow = Bun.YAML.parse(await Bun.file('.github/workflows/release.yml').text());

test.each([
  ['workflow_dispatch', 'check', ['chrome', 'firefox']],
  ['workflow_dispatch', 'both', ['chrome', 'firefox']],
  ['workflow_dispatch', 'chrome', ['chrome']],
  ['workflow_dispatch', 'firefox', ['firefox']],
  ['push', undefined, ['chrome', 'firefox']],
])('%s with %s selects the expected store jobs', (event, store, expected) => {
  const selected = ['chrome', 'firefox'].filter((name) =>
    runInNewContext(workflow.jobs[name].if, { github: { event_name: event }, inputs: { store } }),
  );
  expect(selected).toEqual(expected);
});

async function runStoreStep(store, mode, authExitCode = 0) {
  const directory = await mkdtemp(join(tmpdir(), 'youtube-release-test-'));
  try {
    await mkdir(join(directory, 'node_modules/.bin'), { recursive: true });
    await writeFile(
      join(directory, 'node'),
      '#!/bin/sh\nprintf "node %s\\n" "$*"\nexit "${AUTH_EXIT_CODE:-0}"\n',
      { mode: 0o755 },
    );
    await writeFile(
      join(directory, 'node_modules/.bin/web-ext'),
      '#!/bin/sh\nprintf "web-ext %s\\n" "$*"\n',
      { mode: 0o755 },
    );
    const step = workflow.jobs[store].steps.find((step) => step.env);
    return spawnSync('bash', ['-e', '-o', 'pipefail', '-c', step.run], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        PATH: `${directory}:${process.env.PATH}`,
        RELEASE_MODE: mode,
        WEB_EXT_API_KEY: 'test-issuer',
        WEB_EXT_API_SECRET: 'test-secret',
        AUTH_EXIT_CODE: String(authExitCode),
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('check mode invokes only the read-only checks for both stores', async () => {
  expect(workflow.on.workflow_dispatch.inputs.store.default).toBe('check');
  const chrome = await runStoreStep('chrome', 'check');
  const firefox = await runStoreStep('firefox', 'check');
  expect(chrome.status).toBe(0);
  expect(firefox.status).toBe(0);
  expect(chrome.stdout).toBe('node scripts/publish-chrome.mjs --check-auth\n');
  expect(firefox.stdout).toBe('node scripts/check-firefox-auth.mjs\n');
});

test('submission mode still submits both stores and includes the Firefox source archive', async () => {
  const chrome = await runStoreStep('chrome', 'both');
  const firefox = await runStoreStep('firefox', 'both');
  expect(chrome.status).toBe(0);
  expect(firefox.status).toBe(0);
  expect(chrome.stdout).toBe('node scripts/publish-chrome.mjs\n');
  expect(firefox.stdout).toBe(
    'node scripts/check-firefox-auth.mjs\n' +
      'web-ext sign --source-dir dist/firefox --channel listed --upload-source-code artifacts/youtube-essentials-source.zip --approval-timeout 0\n',
  );
});

test('a failed Firefox access check prevents submission', async () => {
  const result = await runStoreStep('firefox', 'both', 1);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('node scripts/check-firefox-auth.mjs\n');
});
