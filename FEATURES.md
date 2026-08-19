# Color Palette feature list

Everything in phase 1 is built and running in the app. Phase 2 is what was left out of v1 on purpose.

---

## Phase 1 (shipped)

### Color engine

- [x] Hand-rolled OKLCH engine, no color dependencies
- [x] sRGB to linear to OKLab to OKLCH conversions, both directions
- [x] Gamut mapping by binary search on chroma (hue never drifts)
- [x] 360-entry cusp lookup table built at module load
- [x] `#ffffff` / `#000000` short circuits at the lightness extremes
- [x] WCAG contrast ratio and readable ink color per swatch
- [x] Pure functions only: nothing in `src/lib/` reads the clock or calls `Math.random`

### Generator

- [x] 2 to 24 colors
- [x] Harmony modes: spectrum, true rainbow, analogous, complementary, split complementary, triad, tetrad, monochrome
- [x] True rainbow places the seven named spectral hues, so yellow is yellow rather than amber
- [x] Other counts interpolate along the named path instead of drifting off it
- [x] True rainbow is the default the app lands on; the even sweep is one click away as the Spectrum preset
- [x] The even sweep's output is byte-identical to the engine before harmony existed
- [x] Anchor modes place every color on fixed offsets from the start hue (180 / 150+210 / 120+240 / 90+180+270)
- [x] Analogous caps the spread at 90 degrees and honors the slider below that
- [x] Colors go round the anchors one at a time, so 7 over 3 anchors lands 3/2/2
- [x] Repeats on one anchor fan their lightness out and taper their chroma, so no color appears twice
- [x] Monochrome reads as one hue through N distinct lightness and chroma stops
- [x] Hue spread, direction, and easing hidden on the modes that do not read them
- [x] Start hue (0 to 360) and hue spread (30 to 360)
- [x] Clockwise or counter-clockwise sweep
- [x] Full 360 spread divides by count, so the first and last color are not twins
- [x] Natural lightness mode: per-hue lightness follows the sRGB gamut cusp
- [x] Flat lightness mode for one lightness across every hue
- [x] Lightness knob flattens the natural curve toward a target
- [x] Vivid chroma mode (a factor of each hue's maximum)
- [x] Even chroma mode (every hue clamped to the sweep's minimum)
- [x] Lightness arc and chroma arc for a brighter or duller middle
- [x] Hue easing: linear, ease in, ease out, ease in-out

### Tint and shade grid

- [x] Step size 2% to 25%
- [x] 0 to 9 steps in each direction (0 leaves the bare rainbow row; 9 at 10% runs the full ladder)
- [x] Step gutter labels carry the direction: +40% lighter, -40% darker
- [x] Steps move a percentage of the remaining distance to white or black
- [x] Ladders stop at 95%, so no rung is pure white or pure black
- [x] Chroma held at the base value and gamut-clamped per step
- [x] Pastel tints slider (0 to 50%) for classic desaturated tints
- [x] Repeated hexes at the far ends flagged as collapsed instead of shown twice
- [x] Base row rendered taller, ringed, and labeled
- [x] Column layout or row layout
- [x] Click any cell to copy its value, with a toast

### Custom palettes

- [x] Paste hex or `rgb()` colors; separators, prefixes, and junk tokens tolerated
- [x] Palettes cap at 24 colors everywhere (paste, add, share), with a notice when a paste is trimmed
- [x] Bad tokens reported back rather than silently dropped
- [x] Editing a generated swatch forks the palette to custom, keeping the ramp
- [x] Back to generated in one click, with the custom colors preserved
- [x] Swatch editor: hex field, native color input, lightness/chroma/hue sliders
- [x] Add a color (interpolated from its neighbors), duplicate, remove
- [x] Drag to reorder the base row
- [x] Sort by hue, reverse, distribute evenly

### Harmonize filters

- [x] Unify (hue and chroma converge together)
- [x] Hue shift, plus or minus 180 degrees
- [x] Temperature as an OKLab a/b offset, independent of hue shift
- [x] Saturation scale, 0 to 200%
- [x] Lightness shift
- [x] Contrast (spreads or compresses lightness around the mean)
- [x] Preserve neutrals: anything under 2% chroma is left alone
- [x] Single-color palettes degrade to identity instead of dividing by zero
- [x] One gamut clamp at the end of the pipeline, never mid-chain

### Presets

- [x] 40 presets across five pages, covering every harmony mode
- [x] Each preset states its whole generator arc, harmony included, and its whole adjustment stack, so it cannot inherit a stray slider
- [x] Applied over current settings: color count, steps, display, and naming survive
- [x] Live CSS-gradient thumbnails, paginated eight to a page, following the active preset
- [x] A fixture measures every preset against every other and fails on near-duplicates

### Naming and color units

- [x] Hue names from a 17-anchor lookup table, or plain indexes
- [x] `gray` for anything under 2% chroma
- [x] Duplicate names deduped by suffix
- [x] Custom name prefix, sanitized to `[a-z0-9-]`
- [x] Tailwind-style 50 to 950 step tokens
- [x] Percent-style step tokens (`l10`, `d20`)
- [x] 8 color units: hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `hwb()`, `oklch()`, `oklab()`
- [x] Values serialized from the internal OKLCH value, not re-parsed from hex
- [x] One unit setting drives code exports, swatch labels, and editor readouts

### Export

- [x] CSS custom properties
- [x] SCSS, including per-color maps
- [x] LESS
- [x] Tailwind color object, with an optional `module.exports` wrapper
- [x] JSON design tokens in W3C DTCG shape, with a flat name-and-value toggle
- [x] SVG swatch sheet
- [x] PNG, JPG, and WebP at 1x, 2x, or 3x
- [x] Live code preview of the exact file content before export
- [x] Live thumbnail for image formats, honoring scale, labels, and background
- [x] Copy to clipboard and download for every code format
- [x] Copy image to clipboard where the browser supports it, download everywhere
- [x] JPG forced opaque; PNG skips the quality argument
- [x] Filenames carry the color count and a timestamp
- [x] Per-format options remembered between sessions

### Interface

- [x] Header with randomize, undo, redo, reset, share, theme toggle, and export
- [x] Sidebar driven entirely by the param registry, with collapsible sections
- [x] Section open/closed state remembered
- [x] Generator controls stay visible but disabled in custom mode, with a note
- [x] Stage toolbar: source toggle, color count stepper, paste, sort, reverse, distribute
- [x] Swatch shape (square, rounded, circle) and size, 48 to 160px
- [x] Swatch labels off, by name, or by value in the chosen unit
- [x] Step labels toggle
- [x] Preview background: theme, white, black, or checker
- [x] Optional WCAG contrast badges
- [x] Stage footer tally of colors and total swatches, plus one-click Copy CSS and PNG
- [x] Toasts for copy and import results
- [x] Tooltip on randomize explaining what it will roll in the current mode
- [x] Help text on the controls that need it
- [x] Dark and light themes, seeded from the OS setting and remembered
- [x] Below 900px the sidebar becomes a slide-over drawer behind a scrim, with focus trapped while open
- [x] Header actions fold into an overflow menu at narrow widths; toolbar extras fold into a More menu
- [x] Step-label column and base row stay pinned while the grid scrolls

### State, history, and sharing

- [x] Live settings versus committed checkpoints, so one slider drag is one undo entry
- [x] Undo and redo, capped at 30 steps
- [x] Reset to defaults
- [x] Randomize, context-aware: generator rolls in generated mode, adjustments only in custom mode
- [x] Randomize never touches count, steps, display, or naming
- [x] Seeded PRNG, so a roll can be reproduced
- [x] Share URL: the whole configuration diffed against defaults and packed into the hash
- [x] Custom colors ride along in the URL
- [x] Decoded colors validated before they reach the DOM
- [x] URL rewritten on commit only, replacing the history entry rather than pushing

### Keyboard and accessibility

- [x] `R` randomize, `Ctrl/Cmd+Z` undo, `Ctrl+Y` redo, `E` export, `C` copy CSS
- [x] Arrow keys move between base swatches, in both grid orientations
- [x] `Enter` or `Space` opens the swatch editor, `Delete` removes a color
- [x] `Esc` closes dialogs and popovers
- [x] Shortcuts suppressed while typing or while a dialog holds focus
- [x] Per-swatch `aria-label` naming the color, its value, and its step
- [x] `aria-live` toast region
- [x] Visible `:focus-visible` rings throughout
- [x] `prefers-reduced-motion` respected

### Build and verification

- [x] Vite 5 and React 18, plain JavaScript, co-located CSS
- [x] `base: './'` so the GitHub Pages subpath build resolves its assets
- [x] FontAwesome via npm behind one icon map, no CDN, no runtime requests
- [x] `npm run verify:engine`: 116 checks on the color math
- [x] `npm run verify:exports`: 83 checks on the 9 export formats
- [x] GitHub Actions deploy to Pages on push to `master`

---

## Phase 2 (ideas, not built)

- [ ] Letter-style token names (`a`, `b`, `c`) alongside hue names and indexes
- [ ] Saved palette library in localStorage, so a palette survives without keeping its URL
- [ ] Contrast-pair suggestions: which steps clear WCAG AA against which other steps, surfaced as text and background pairs
- [ ] Import from an image (pull the dominant colors and treat them as a custom palette)
- [ ] Clamp-ends toggle, if the fixed 95% stop ever gets in the way

---

## Out of scope

- Accounts, saved cloud palettes, or any server
- Analytics or usage counters
- CMYK and print color spaces (this is a screen tool; sRGB is the target gamut)
- Color-blindness simulation (worth a separate tool, not a slider here)
