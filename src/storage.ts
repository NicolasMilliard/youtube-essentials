export type Theme = 'system' | 'light' | 'dark';

export type Settings = {
  hideShorts: boolean;
  allowShortsOnChannels: boolean;
  hidePlayables: boolean;
  hideYtFeatured: boolean;
  quietWatch: boolean;
  redirectHome: boolean;
  theme: Theme;
};

export const DEFAULT_SETTINGS: Settings = {
  hideShorts: true,
  allowShortsOnChannels: true,
  hidePlayables: true,
  hideYtFeatured: true,
  quietWatch: false,
  redirectHome: false,
  theme: 'system',
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get([
    'hideShorts',
    'allowShortsOnChannels',
    'hidePlayables',
    'hideYtFeatured',
    'quietWatch',
    'redirectHome',
    'theme',
  ]);

  const theme =
    stored.theme === 'light' || stored.theme === 'dark' || stored.theme === 'system'
      ? stored.theme
      : DEFAULT_SETTINGS.theme;

  return {
    hideShorts:
      typeof stored.hideShorts === 'boolean' ? stored.hideShorts : DEFAULT_SETTINGS.hideShorts,
    allowShortsOnChannels:
      typeof stored.allowShortsOnChannels === 'boolean'
        ? stored.allowShortsOnChannels
        : DEFAULT_SETTINGS.allowShortsOnChannels,
    hidePlayables:
      typeof stored.hidePlayables === 'boolean'
        ? stored.hidePlayables
        : DEFAULT_SETTINGS.hidePlayables,
    hideYtFeatured:
      typeof stored.hideYtFeatured === 'boolean'
        ? stored.hideYtFeatured
        : DEFAULT_SETTINGS.hideYtFeatured,
    quietWatch:
      typeof stored.quietWatch === 'boolean' ? stored.quietWatch : DEFAULT_SETTINGS.quietWatch,
    redirectHome:
      typeof stored.redirectHome === 'boolean'
        ? stored.redirectHome
        : DEFAULT_SETTINGS.redirectHome,
    theme,
  };
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): Promise<void> {
  await chrome.storage.local.set({
    [key]: value,
  });
}
