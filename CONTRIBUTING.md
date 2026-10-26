# Contributing to YouTube Essentials

Contributions are welcome: bug reports, documentation improvements, fixes, and features that help reduce distractions while preserving intentional viewing.

For larger changes, open an issue first to discuss the problem and approach.

## Development setup

You will need:

- Bun 1.3.13
- Node.js 22 or later for Mozilla's web-ext tooling
- Chrome 120+ or Firefox 140+

Fork and clone the repository, then install dependencies:

```bash
bun install --frozen-lockfile
```

Create a branch for your change.

For Chrome development:

```bash
bun run dev:chrome
```

For Firefox development:

```bash
bun run dev:firefox
```

See the [README](README.md#development) for instructions on loading the extension into each browser.

## Making changes

- Keep pull requests focused on one change.
- Follow the existing TypeScript and CSS conventions.
- Keep shared behavior compatible with Chrome and Firefox.
- Avoid adding tracking, analytics, or unnecessary permissions.
- Update documentation when behavior or setup changes.
- Add or update tests when changing behavior covered by automated tests.

## Validation

Format your changes and run the checks:

```bash
bun run format
bun run check
```

The checks cover formatting, TypeScript, automated tests, both browser builds, and Firefox add-on validation.

For behavior or UI changes, also test manually in Chrome and Firefox. Check the affected YouTube pages, navigation without a full reload, and saved settings. For popup changes, check keyboard navigation and light and dark themes.

Documentation-only changes do not require browser testing.

## Pull requests

Open your pull request against `main`. Explain:

- What problem the change solves
- What changed
- How you tested it, including browser versions where relevant
- Any known limitations or testing gaps

Include screenshots for visible UI changes and link related issues.

## Reporting bugs and requesting features

Search existing issues before opening a new one. Use the bug report or feature request template and provide enough detail to understand or reproduce the problem.

For suspected security vulnerabilities, follow [SECURITY.md](SECURITY.md).

## License

Contributions are provided under the project's [MIT license](LICENSE.md).
