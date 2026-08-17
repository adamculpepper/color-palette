# Changelog

The number here, in `package.json`, and in `src/data/version.js` are the same number; `npm run verify:exports` fails when they drift. A fix bumps the patch, a feature bumps the minor, and the bump lands in the same change as the work. This log was reconstructed retroactively when the rule was adopted, so the early entries carry the versions they should have carried at the time.

## [1.1.2] - 2026-08-17

- Tooltips flip below their trigger when there is no room above, so the Randomize tooltip is no longer cut off at the top of the page.
- A light-mode reload no longer flashes the dark theme: a pre-paint boot script stamps the saved theme on the page before anything renders.

## [1.1.1] - 2026-08-16

- Circle swatch shape renders true circles in both layouts. Step cells were wider than tall, so the old radius produced pills; circles now get equal sides, with the step dots at 72% of the base diameter and the corner badges pulled inside the curve.
- Version discipline made retroactive: this changelog, plus a fixture check that fails when the header, package.json, and the top entry here disagree.

## [1.1.0] - 2026-08-16

- Tint and shade cells show a copy icon on hover and keyboard focus, so a cell reads as click-to-copy.
- The collapsed-duplicate marker (a rung identical to its neighbor) now shows an equals sign instead of sharing the copy icon.
- The selection ring on a base swatch is tied to its editor being open; no ring lingers after closing by any path.

## [1.0.1] - 2026-08-16

- Long color values (`rgb()`, `oklch()`) wrap onto up to three centered lines inside their cells instead of clipping with an ellipsis.

## [1.0.0] - 2026-08-16

Renamed Rainbow Generator to Color Palette, matching the repo, and grew into the name.

- Seven harmony modes: spectrum (the rainbow sweep, still the default), analogous, complementary, split complementary, triad, tetrad, monochrome. Extra colors on an anchor come back lighter or darker rather than duplicated. Two new presets (Duotone, Triad).
- The arc controls (spread, direction, easing) hide on modes that never read them.
- Dark theme lifted from near-black to a charcoal ramp, with text re-tuned to keep 4.5:1 contrast everywhere.
- The color count stepper buttons got resting backgrounds.
- The standing ring around the base row removed; it now appears on hover and selection only.
- Engine fixture grew to 116 checks.

## [0.6.1] - 2026-08-16

- Base row hex labels moved inside the swatch blocks, bottom-aligned, in a per-swatch readable ink.
- The Base gutter label is vertically centered against its block.
- Default ladder depth tuned to five steps each way.

## [0.6.0] - 2026-08-15

- Every step row is labeled with its direction: +40% lighter, -40% darker, with a tooltip spelling it out.
- The full nine-step ladder (10% shy of white and black) became a first-class view.

## [0.5.1] - 2026-08-15

Adversarial review pass: four reviewer lenses, every finding independently re-verified, sixteen confirmed and fixed. The big ones:

- Forking a generated palette to custom re-applied the adjustment filters to already-filtered colors. Custom palettes now store pre-adjustment values (the sourceHex contract).
- Palettes above 24 colors were silently truncated on reload or share; the cap is now enforced at paste, add, and share, with a notice.
- First-time JPG and WebP exports encoded at roughly 1% quality from a unit mismatch.
- Distribute evenly let an invisible gray's noise hue steer every other swatch.
- A name collision in code exports could silently drop a color.
- Keyboard shortcuts went dead after touching any slider.
- Regression checks for all of it (fixtures at 82 and 83 checks).

## [0.5.0] - 2026-08-15

- Phone layout: the sidebar becomes a slide-over drawer, header actions fold into an overflow menu, the step-label column and base row pin during scroll.
- Accessibility pass: focus traps on every dialog, visible focus rings, contrast re-tune, reduced-motion support, aria labels throughout.
- README, FEATURES, and the GitHub Pages deploy workflow.

## [0.4.0] - 2026-08-15

- Share links carrying the whole configuration (custom colors included) in the URL, validated on the way back in.
- Seeded randomize, context-aware: generator settings in generated mode, adjustments only on a custom palette.
- Twelve presets with live gradient thumbnails.
- Keyboard shortcuts and wired undo/redo.

## [0.3.0] - 2026-08-15

- The palette grid: tint/shade ladder, swatch editor popover, paste import, drag reorder, sort/reverse/distribute.
- Custom palettes that fork seamlessly from the generated rainbow.
- The export system: CSS, SCSS, LESS, Tailwind, JSON tokens, SVG sheet, PNG/JPG/WebP, in eight color units, preview-first.

## [0.2.0] - 2026-08-15

- The OKLCH color engine: conversions, gamut mapping by chroma search, natural per-hue lightness, harmonize filters, tint/shade math, naming.
- The registry-driven control sidebar and the state store with undo/redo.
- The first fixture suite (60 engine checks).

## [0.1.0] - 2026-08-15

- Scaffold: Vite 5 + React 18, design tokens, dark and light themes, repo init.
