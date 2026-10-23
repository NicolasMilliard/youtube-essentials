import { expect, test } from 'bun:test';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import type * as SettingsModule from '../src/storage';

const result = await build({
  entryPoints: ['src/storage.ts'],
  bundle: true,
  format: 'cjs',
  write: false,
});
const bundledStorage = result.outputFiles[0]!.text;

function createStorage(initial: Record<string, unknown> = {}) {
  const values = { ...initial };

  return {
    local: {
      async get() {
        return { ...values };
      },
      async set(items: Record<string, unknown>) {
        Object.assign(values, items);
      },
    },
  };
}

function loadSettings(
  browserName: 'chrome' | 'firefox',
  storage: ReturnType<typeof createStorage>,
) {
  const module = { exports: {} };
  const globals =
    browserName === 'firefox'
      ? {
          browser: { storage },
          chrome: {
            get storage() {
              throw new Error('Firefox must use browser.storage for promises');
            },
          },
        }
      : { chrome: { storage } };

  runInNewContext(bundledStorage, { ...globals, module, exports: module.exports });

  return module.exports as typeof SettingsModule;
}

test.each(['chrome', 'firefox'] as const)(
  '%s loads defaults and persists settings',
  async (name) => {
    const { DEFAULT_SETTINGS, getSettings, setSetting } = loadSettings(name, createStorage());

    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);

    await setSetting('hideShorts', false);
    await setSetting('quietWatch', true);
    await setSetting('redirectHome', true);
    await setSetting('theme', 'dark');

    expect(await getSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      hideShorts: false,
      quietWatch: true,
      redirectHome: true,
      theme: 'dark',
    });
  },
);

test.each(['chrome', 'firefox'] as const)(
  '%s preserves valid settings and defaults invalid values',
  async (name) => {
    const { DEFAULT_SETTINGS, getSettings } = loadSettings(
      name,
      createStorage({ hideShorts: false, theme: 'invalid', quietWatch: 'true' }),
    );

    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, hideShorts: false });
  },
);

test.each(['chrome', 'firefox'] as const)('%s propagates storage failures', async (name) => {
  const storage = createStorage();
  storage.local.get = async () => {
    throw new Error('Read failed');
  };
  storage.local.set = async () => {
    throw new Error('Write failed');
  };

  const { getSettings, setSetting } = loadSettings(name, storage);

  await expect(getSettings()).rejects.toThrow('Read failed');
  await expect(setSetting('theme', 'dark')).rejects.toThrow('Write failed');
});
