import { getSettings } from '../storage';

const ATTRIBUTES = {
  hideShorts: 'data-youtube-essentials-hide-shorts',
  allowShortsOnChannels: 'data-youtube-essentials-allow-shorts-on-channels',
  hidePlayables: 'data-youtube-essentials-hide-playables',
  hideYtFeatured: 'data-youtube-essentials-hide-yt-featured',
  quietWatch: 'data-youtube-essentials-quiet-watch',
} as const;

function applySetting(attribute: string, enabled: boolean): void {
  document.documentElement.toggleAttribute(attribute, enabled);
}

function isCanonicalHome(): boolean {
  const { origin, pathname, search, hash } = window.location;

  return origin === 'https://www.youtube.com' && pathname === '/' && search === '' && hash === '';
}

async function init(): Promise<void> {
  const startedOnCanonicalHome = isCanonicalHome();
  const settings = await getSettings();

  if (startedOnCanonicalHome && settings.redirectHome) {
    window.location.replace('/feed/subscriptions');
    return;
  }

  applySetting(ATTRIBUTES.hideShorts, settings.hideShorts);
  applySetting(ATTRIBUTES.allowShortsOnChannels, settings.allowShortsOnChannels);

  applySetting(ATTRIBUTES.hidePlayables, settings.hidePlayables);
  applySetting(ATTRIBUTES.hideYtFeatured, settings.hideYtFeatured);
  applySetting(ATTRIBUTES.quietWatch, settings.quietWatch);

  startShortsFilterObserver();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  const hideShorts = changes.hideShorts?.newValue;

  if (typeof hideShorts === 'boolean') {
    applySetting(ATTRIBUTES.hideShorts, hideShorts);
  }

  const allowShortsOnChannels = changes.allowShortsOnChannels?.newValue;

  if (typeof allowShortsOnChannels === 'boolean') {
    applySetting(ATTRIBUTES.allowShortsOnChannels, allowShortsOnChannels);
  }

  const hidePlayables = changes.hidePlayables?.newValue;

  if (typeof hidePlayables === 'boolean') {
    applySetting(ATTRIBUTES.hidePlayables, hidePlayables);
  }

  const hideYtFeatured = changes.hideYtFeatured?.newValue;

  if (typeof hideYtFeatured === 'boolean') {
    applySetting(ATTRIBUTES.hideYtFeatured, hideYtFeatured);
  }

  const quietWatch = changes.quietWatch?.newValue;

  if (typeof quietWatch === 'boolean') {
    applySetting(ATTRIBUTES.quietWatch, quietWatch);
  }
});

const SHORTS_FILTER_SELECTOR = 'yt-chip-cloud-chip-renderer';
const SHORTS_FILTER_ATTRIBUTE = 'data-youtube-essentials-shorts-filter';

function markShortsFilterChip(chip: Element): void {
  if (!chip.closest('ytd-search')) {
    return;
  }

  const isShortsFilter = chip.textContent?.trim() === 'Shorts';

  chip.toggleAttribute(SHORTS_FILTER_ATTRIBUTE, isShortsFilter);
}

function scanForShortsFilters(node: Node): void {
  if (!(node instanceof Element)) {
    return;
  }

  const closestChip = node.closest(SHORTS_FILTER_SELECTOR);

  if (closestChip) {
    markShortsFilterChip(closestChip);
  }

  node.querySelectorAll(SHORTS_FILTER_SELECTOR).forEach(markShortsFilterChip);
}

function startShortsFilterObserver(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        scanForShortsFilters(node);
      }
    }
  });

  observer.observe(document, {
    childList: true,
    subtree: true,
  });

  scanForShortsFilters(document.documentElement);
}

void init();
