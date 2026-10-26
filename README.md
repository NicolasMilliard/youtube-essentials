# YouTube Essentials

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/youtube-essentials/ehifhlciopjmjlfgdgkkamfhkjgjamig)

[![Firefox Add-ons](https://img.shields.io/badge/Firefox_Add--ons-Install-FF7139?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox/addon/youtube-essentials/)

> YouTube, minus the noise.

YouTube Essentials is a lightweight extension for Chrome and Firefox that removes distracting content from YouTube while keeping the core viewing experience intact.

No account. No analytics. No backend. Your preferences stay in your browser.

## Features

- Hide Shorts from navigation and recommendations
- Optionally keep Shorts accessible on creator channel pages
- Hide YouTube Playables from the home feed
- Hide featured videos from the home feed
- Quiet watch: optionally hide the full watch-page sidebar
- Light, dark, and system themes
- Settings stored locally using the browser's extension storage
- No tracking or external requests

## Philosophy

YouTube Essentials is not designed to block YouTube.

It is designed to remove content that is pushed at you, while keeping intentional viewing available.

For example, Shorts can stay hidden from recommendations while remaining accessible when you deliberately visit a creator's channel.

### Quiet watch

Turn on **Quiet watch** in the popup's **Content** section to hide the full sidebar beside a
video. It is off by default, saved locally, and changes take effect on open YouTube tabs
without a refresh.

Quiet watch hides the `#secondary` watch-page container. This removes recommendations along
with any playlist panel, live chat, transcript, donation, and other panels that YouTube puts
there. On narrow layouts, YouTube can move recommendations below the player; Quiet watch
hides that `#related` section too. The video, description, and comments remain available.
YouTube may recalculate the player layout when the sidebar is hidden.

Quiet watch does not disable autoplay or hide suggestions inside the player, such as end
screens.

## Development

### Requirements

- [Bun](https://bun.sh/) 1.3.13 (used for the reproducible build)
- [Node.js](https://nodejs.org/) 22 or later for Mozilla's `web-ext` tooling
- Google Chrome 120+ (or another compatible Chromium-based browser), or desktop Firefox 140+

Firefox 140 is the minimum supported version for the built-in data collection declaration.
It also supports the `:has()` CSS selectors used to filter YouTube content.

### Install dependencies

```bash
bun install --frozen-lockfile
```

### Chrome development

```bash
bun run dev
```

This watches TypeScript, the manifest, and static files and updates `dist/chrome/`.

After changing extension files:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Load `dist/chrome/` with **Load unpacked**
4. Reload the extension when necessary
5. Refresh YouTube

If you previously loaded `dist/`, remove that unpacked development installation and load
`dist/chrome/` instead. Production Chrome Web Store installations are unaffected.

### Firefox development

```bash
bun run dev:firefox
```

This watches the shared source and both manifest files and updates `dist/firefox/`.
In Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `dist/firefox/manifest.json`
4. Reload the extension after changes, then refresh YouTube

Temporary installations are removed when Firefox closes. Allow the extension access to
`www.youtube.com`; if access is revoked, the content filters cannot run.

Alternatively, use a separate terminal to launch a temporary Firefox profile with automatic
extension reloading while `dev:firefox` is running:

```bash
bun run start:firefox
```

Refresh YouTube after an extension reload. Restart the build watcher if you change
`strict_min_version`, since esbuild's compilation target is selected at startup.

### Build

```bash
bun run build:chrome   # Chrome explicitly
bun run build:firefox  # Firefox
bun run build:all      # Both browsers
```

Each build cleans only its own output directory. The shared `manifest.json` supplies the
extension's version, permissions, popup, and content scripts. The Firefox build merges in the
top-level fields from `manifest.firefox.json`, including the stable add-on ID, minimum Firefox
version, and declaration that no data is collected. Firefox metadata is excluded from Chrome.

### Validate

```bash
bun run check
```

This runs formatting checks, TypeScript validation for the extension and TypeScript tests,
storage compatibility and release workflow tests, both production builds, and Mozilla's add-on validator.
Release tests use mocked API responses and commands; they do not contact either store.

The current validator also checks Android compatibility even without a `gecko_android`
manifest entry. It reports `KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION` because the data
collection declaration arrived in Android 142, versus desktop 140. This build supports
desktop Firefox only; Android compatibility is not advertised. Review any other validation
warnings before releasing.

The individual commands are `bun run test` and `bun run lint:firefox` (the latter requires
`bun run build:firefox` first).

Before a Firefox release, manually check both the minimum supported version and current Firefox:

- All content toggles, including Shorts on channel pages and Shorts search filters
- Home, search, channel, and watch pages, including YouTube's internal navigation
- Quiet watch at wide and narrow window sizes
- Homepage redirection when enabled, with no redirect for other URLs
- Popup layout, keyboard controls, and light/dark/system themes
- Saved settings after reopening the popup and live changes across multiple YouTube tabs
- Revoking and restoring YouTube site access, then refreshing the page
- Persistence across browser restarts using a signed installation

Run a Chrome smoke check as well because both browsers share the application code.

### Package and distribute

```bash
bun run package:chrome
bun run package:firefox
```

Both commands run the full validation first. They create
`artifacts/youtube-essentials-chrome.zip` and `artifacts/youtube-essentials-firefox.zip`,
respectively.
Each archive contains only that browser's built extension, with `manifest.json` at its root.

The Firefox archive is unsigned. For normal installation in Firefox, submit it to
[Mozilla Add-ons](https://addons.mozilla.org/developers/) for signing, choosing either a public
listing or unlisted distribution. Keep `browser_specific_settings.gecko.id` unchanged for
future releases. Building and packaging locally does not submit or publish anything.

Because the extension is built from TypeScript, Mozilla also requires a source archive.
Include `src/`, `scripts/`, `tests/`, both manifest files, `package.json`, `bun.lock`,
`tsconfig.json`, the Prettier configuration files, this README, and the license/privacy files.
Exclude `node_modules/`, `dist/`, `.git/`, and generated archives. From that source archive's
root directory, a reviewer can reproduce the Firefox build with:

```bash
bun install --frozen-lockfile
bun run build:firefox
```

These commands were validated with Bun 1.3.13 on macOS. No environment variables, credentials,
or OS-specific build tools are needed. The generated `dist/firefox/` files are the files to
compare with the submitted extension archive.

### Automated store releases

The **Release** GitHub Actions workflow builds and submits updates to both existing store
listings when a tag such as `v1.1.2` is pushed. The tag must match the version in
`manifest.json`. It runs `bun run check`, packages both browsers, and creates a source
archive from the tagged commit for Mozilla reviewers. Chrome and Firefox submissions run
in separate jobs.

Configure these repository settings under **Settings → Secrets and variables → Actions**:

| Setting                    | Type     | Value                                                                                                 |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `CWS_SERVICE_ACCOUNT_JSON` | Secret   | Complete JSON key for the service account linked to the Chrome Web Store publisher                    |
| `CWS_PUBLISHER_ID`         | Variable | Chrome Web Store publisher ID                                                                         |
| `CWS_EXTENSION_ID`         | Variable | Chrome Web Store extension ID                                                                         |
| `AMO_JWT_ISSUER`           | Secret   | Mozilla API key from the [API credentials page](https://addons.mozilla.org/developers/addon/api/key/) |
| `AMO_JWT_SECRET`           | Secret   | Associated Mozilla API secret                                                                         |

Once the workflow is on the default branch, use **Actions → Release → Run workflow** with
`store: check` and `ref: main` to validate access to **both stores without submitting an update**.
Chrome reads the extension status. Firefox authenticates with the AMO credentials and checks
that the ID from the packaged Firefox manifest appears in the account's add-ons, using the
[authenticated add-on list](https://mozilla.github.io/addons-server/topics/api/addons.html#list).
These checks validate access; they do not guarantee that a future submission will pass store validation or review.

For an actual release, merge the version bump and changes, then push the matching version
tag. A manual run with `store: both`, `chrome`, or `firefox` requires an existing matching
version tag in `ref`. Firefox also checks access before submitting its package and source.
If only one store job fails, inspect its dashboard and retry that store alone; a previous
submission may already have been accepted. Successful submission does not mean review is complete.

## Project structure

```text
.
├── src/
│   ├── assets/
│   │   └── icons/
│   ├── content/
│   │   ├── content.css
│   │   └── index.ts
│   ├── popup/
│   │   ├── popup.css
│   │   ├── popup.html
│   │   └── popup.ts
│   ├── extension.ts
│   └── storage.ts
├── scripts/
│   ├── build.mjs
│   ├── check-firefox-auth.mjs
│   └── publish-chrome.mjs
├── manifest.json
├── manifest.firefox.json
├── tests/
│   ├── check-firefox-auth.test.js
│   ├── release-workflow.test.js
│   ├── storage.test.ts
│   └── tsconfig.json
└── tsconfig.json
```

## Privacy

YouTube Essentials does not collect, transmit, sell, or analyze user data.

The extension:

- does not use analytics
- does not communicate with a backend
- does not make external network requests
- does not require an account
- stores preferences locally using the browser's extension storage

The extension only runs on YouTube pages in order to hide the selected interface elements.

## How it works

YouTube Essentials uses a small content script to apply settings as attributes to the YouTube document.

CSS selectors then hide the corresponding interface elements.

```text
User preference
      ↓
Browser extension storage
      ↓
Content script
      ↓
data-* attributes
      ↓
CSS
```

This keeps the implementation lightweight and avoids unnecessary DOM polling or content analysis.

## Limitations

YouTube Essentials relies on YouTube's current DOM structure and web components.

YouTube can change its interface without notice, which may occasionally require selectors to be updated.

If something stops being hidden after a YouTube update, feel free to open an issue.

## License

[MIT](./LICENSE.md)
