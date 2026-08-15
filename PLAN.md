# Rainbow Generator — Implementation Plan

New project at `C:\repos\rainbow-generator` (folder exists, empty; will be `git init`-ed).

## Context

Adam wants a tool for building rainbow color palettes that actually work together. A normal rainbow is 7 colors (ROYGBIV); this tool generates rainbows of any size up to 15 and beyond, shows stepped lighter/darker variants of every color (10%, 20%, ...), lets him start from his own palette instead of a generated one, and gives him global adjustment filters (saturation, hue shift, lightness, etc.) to tune until all the colors feel like one family. When it looks right, he exports it: CSS variables, SCSS, LESS, Tailwind config, JSON tokens, an SVG swatch sheet, and PNG/JPG/WebP images.

## Decisions locked with Adam

- **Stack:** Vite 5 + React 18, plain JavaScript, no TypeScript, plain co-located CSS. Same skeleton as `topographic-generator`.
- **Exports (all confirmed):** pure CSS variables, SCSS, LESS, Tailwind config, JSON tokens, SVG swatch sheet, PNG/JPG/WebP images. Code formats get copy-to-clipboard and download; images download (and copy-to-clipboard where the browser supports it).
- **Color unit is selectable** (added by Adam): every code export can emit its values in any well-supported CSS color unit — hex, rgb(), rgba(), hsl(), hsla(), hwb(), oklch(), oklab() — and the exact code is previewed live in the export modal BEFORE exporting.

## Design decisions (mine, called out for review)

- **Hand-rolled OKLCH engine, zero color dependencies.** The app IS color math; `culori`/`chroma-js` rejected (chroma-js's gamut handling is a per-channel RGB clamp that shifts hue, the exact bug this tool exists to avoid). ~90 lines of well-known Ottosson matrices.
- **Perceptual "natural lightness" rainbow.** A flat-lightness rainbow makes yellow render as brown (`#c68c27` at L=0.68). Instead, per-hue lightness follows the sRGB gamut cusp (red 0.63, yellow 0.97, blue 0.49), flattened toward a target by one knob. Verified ROYGBIV default output: `#ec5b4b #e7aa4b #bce158 #5ce2b8 #54c9e6 #4276e6 #b25ce9`.
- **One palette pipeline, no mode split.** The generator seeds an editable palette; editing a swatch auto-forks generated → custom; filters apply identically to both. This is exactly "set a palette and play with the filters."
- **"10% lighter" = 10% of the remaining distance to white** (OKLCH L interpolation; darker mirrors toward black). Self-limiting, so near-white/near-black bases still produce valid ladders. Chroma is gamut-clamped per step with no hue drift.
- **Cut from v1** (each is either redundant or scope creep, all easy to add later): harmony modes (triad/complementary etc.), a separate grayscale slider (Saturation→0 does it), letter-style token names, a clamp-ends toggle (the engine always stops at 95% so ladders never hit pure #fff/#000).

## House conventions this build must honor

- **No BEM** in any form; descriptive semantic class names + native CSS nesting. Do NOT copy the BEM naming documented in glitch/topo CLAUDE.md. Every rule starts from the component root class so nothing leaks (CSS files are global in Vite).
- **Icons:** FontAwesome via npm (`@fortawesome/react-fontawesome`, `fontawesome-svg-core`, `free-solid-svg-icons`, same set as the dashboard repo), wrapped in one `Icon.jsx` name→icon map. Never unicode glyphs or emoji as UI icons. Do not copy topo's inline-SVG Icon.jsx.
- No CDN links ever; npm + self-host only (fonts too: system stack, or `@fontsource` if a font is wanted).
- No inline `style={{}}` for static values; dynamic values go through inline CSS custom properties (`style={{ '--swatch-size': ... }}`) so the CSS file owns the rules.
- No analytics, no counters, no runtime external requests.
- Senior-level self-describing naming throughout.
- On approval, save this plan as `PLAN.md` in the project root with Adam's original prompt verbatim as an appendix (global rule).
- README/FEATURES copy gets a **humanizer** pass at write time; UI polish milestone uses the **impeccable** skill.
- Commit only when Adam asks; never push.

## Reuse map (explored + spot-verified)

From `C:\repos\topographic-generator` (closest sibling):
- `src\data\params.js` — declarative param registry (one array feeds sidebar, defaults, randomize, URL codec)
- `src\components\controls\*` + `ControlSection` — slider/select/toggle/color controls; live `onChange` + `onCommit` on pointer-up so one drag = one undo entry
- `src\context\AppContext.jsx` — useReducer, `settings` (live) vs `committed` (checkpoint), past/future capped at 30
- `src\lib\stateCodec.js` — base64 diff-vs-defaults URL codec. **Verified gap:** line 9 compares with `!==`, which always flags arrays as changed; fix with a JSON.stringify compare for objects, and validate decoded colors against `/^#[0-9a-f]{6}$/i` (untrusted hash otherwise flows into style attributes)
- `src\lib\exportRaster.js` — **verified:** `saveBlob` (objectURL + anchor click), `MIME = {png,jpg,webp}` map, JPG-forces-opaque-background rule, PNG omits quality. Its `exportName()` uses `Date.now()`: keep timestamps in the UI layer, never in `src\lib\`
- `src\lib\renderSvg.js` — SVG-as-string-array convention; `prng.js` (mulberry32) + `randomize.js` — seeded, registry-driven
- `src\styles\variables.css` / `themes.css` / `global.css` — token layering, `[data-theme]` dark/light
- `.github\workflows\deploy.yml` — GH Pages Actions deploy; KEEP the `rm -f package-lock.json` step (Windows lockfile omits Linux rollup optionals, npm/cli#4828); `vite.config.js` `base: './'`

From `C:\repos\halftones`: `src\hooks\useTheme.js` logic (dark/light, localStorage, prefers-color-scheme), `src\utils\exportUtils.js` (`copyToClipboard` via ClipboardItem, feature-detect + fall back to download on Firefox).
From `c:\repos\glitch`: `SliderControl.jsx` typeable-number focus sync, `Header.jsx` FORMATS registry pattern + 2s "Copied" flag.

Known gap: no repo has HSL/OKLCH math anywhere; the color engine is net-new. spiral-betty's `valueColor` RGB lighten/darken is superseded (per-channel lerp drifts hue), do not port.

## Color engine (`src\lib\`)

```
lib\
  color\oklch.js     conversions + gamut mapping (no imports)
  color\parse.js     hex/rgb()/list paste in → normalized hex out (null per bad token)
  color\format.js    serializers: color → hex | rgb | rgba | hsl | hsla | hwb | oklch | oklab
  color\contrast.js  WCAG ratio + readable ink color (#111 vs #fff)
  rainbow.js         generator params → base OKLCH colors
  scale.js           base color → tint/shade ladder
  harmonize.js       the filter pipeline (pure, palette → palette)
  naming.js          hue names, scale tokens, dedupe
  palette.js         buildPalette(settings) → PaletteModel (the single facade)
```

**`color\oklch.js`:** sRGB↔linear, hex↔rgb, rgb↔OKLab↔OKLCH, `isInGamut`, `maxChroma(L,H)` (binary search), `clampChroma`, `cuspLightness(H)`. Cusp values memoized in a 360-entry LUT built at module load (it is called per color per render). Short-circuits: L≥1 → `#ffffff`, L≤0 → `#000000`.

**`rainbow.js`:** even hue spacing over an arc (default 29°→310°; a full 360° wheel reads as a color wheel, not a rainbow; if span=360 divide by `count` not `count-1` so first ≠ last). Lightness mode `natural` (cusp-derived, flattened by one knob, default flatten 0.35) or `flat`. Chroma mode `vivid` (per-hue: factor × maxChroma at that hue, default 0.8) or `even` (all hues clamped to the sweep minimum, since sRGB max-chroma varies 1.9x across hues at fixed L). Optional lightness/chroma arcs (`amp × sin(π·t)`) and hue easing.

**`scale.js`:** `stepLightness(L, t)` where t≥0 → `L + (1−L)·t`, t<0 → `L·(1+t)`; t = percent/100 clamped to ±0.95. Chroma held at base and gamut-clamped per step (stays vivid mid-ladder, softens naturally at ends). `chromaTaper` (0–50%, default 0) exposed as "Pastel tints" for classic desaturated tints. Adjacent-step hex collisions set `collapsed: true` for the UI to badge instead of silently duplicating. Verified ladder for `#e84739`: `+50 #ffa89b ... 0 #e84739 ... −50 #630000`.

**`harmonize.js`** — pure filters applied in this order, one `clampChroma` at the very end (mid-pipeline clamping compounds error):
1. `hueRotate` (±180°)
2. `hueConverge` (0–1, toward circular mean hue)
3. `temperature` (±1; an OKLab a/b-plane offset, warm +a+b / cool −a−b, which is what keeps it independent of hueRotate)
4. `chromaScale` (0–2)
5. `chromaConverge` (0–1, toward mean chroma)
6. `lightnessShift` (±0.5)
7. `lightnessSpread` (±1; negative compresses toward mean L, positive fans out = contrast dial)

`preserveNeutrals` (default on) gates hue/chroma filters on C ≥ 0.02, verified necessary: an unguarded gray `#c9c9c9` pulled toward mean chroma turns beige `#e1c780` from atan2 noise. Single-color palettes: converge filters degrade to identity (guard the n−1 divisor), never NaN.

**`naming.js`:** 17-anchor OKLCH hue→name LUT (rose 10° ... red 29° ... yellow 110° ... blue 264° ... pink 350°), `gray` when C < 0.02, dedupe by suffix (`blue`, `blue-2`). Scale tokens: Tailwind-style 50–950 (±50% in 10% steps = exactly 11 stops = the 50–950 convention) or percent style (`l10`/`d20`). Custom labels sanitized to `[a-z0-9-]` then deduped.

**`color\format.js`:** one `formatColor(color, unit)` for the eight units, fed from the internal OKLCH value (not re-parsed hex) so hsl/oklch output keeps precision. Sane rounding per unit: rgb as integers, hsl/hwb as `deg` + whole percents, oklch/oklab to 3 decimals, hex lowercase. rgba/hsla emit alpha 1 (palettes are opaque; the units are there because downstream code often wants the alpha slot ready to edit). Used by code exports, swatch labels, and the SwatchEditor readouts, so the whole app speaks one formatting dialect.

**`palette.js`:** the seam. Pipeline: `base = generated ? generateRainbow(params) : customColors` → `harmonize(base, filters)` → per color `buildScale(...)` → named PaletteModel. Synchronous, no async/workers; worst case 24 colors × 19 steps is fine at slider frame rate.

### PaletteModel (contract between engine, UI, and every exporter)

```js
{
  source: 'generated' | 'custom',
  colors: [{
    index, hex,                    // base after adjustments
    name,                          // 'red' | 'color-1' per nameStyle
    token,                         // export id, deduped + sanitized
    base: { L, C, H },
    steps: [                       // lightest → darkest, odd length, pct signed
      { pct: 40, hex, token, isBase: false, collapsed: false },
      { pct: 0,  hex, token, isBase: true },
      { pct: -40, hex, token, isBase: false },
    ],
  }],
  meta: { count, stepPercent, stepCount },
}
```

Exporters take PaletteModel and nothing else. The ExportModal iterates the format registry and branches only on `kind`, never hardcoding format lists.

## Architecture & UI

### One palette pipeline, no mode split

- `customColors` is the ONLY stored color data; everything else derives per render via one `usePalette()` memo (`useMemo(() => buildPalette(settings), [settings])`).
- Editing any swatch in generated mode auto-forks: snapshot the displayed (adjusted) ramp into `customColors`, flip source to custom, apply the edit. "Back to generated" is one action; `customColors` survives, so toggling is lossless and undoable.
- UI control: segmented `Generated | Custom` in the stage toolbar (not the sidebar).
- Generator controls stay visible but disabled in custom mode with an inline "Back to generated" note; never hidden.
- Randomize is context-aware: generated mode rolls the Generator group; custom mode rolls Adjustments only (re-tints a pasted palette instead of destroying it). Never touches count/steps/display/naming.

### Layout

Desktop (≥1100px): Header (brand + version, Randomize, Undo/Redo/Reset, Share, theme toggle, Export) · 304px scrolling sidebar (Presets + registry-driven collapsible sections) · Stage. Stage toolbar: source toggle, color-count stepper, Paste hex, Sort by hue, Reverse, Distribute evenly. Below it **PaletteGrid**: one grid where the base rainbow is the 0% row (taller, ringed, hex-labeled), tint rows above (+10%...), shade rows below (−10%...). Column-per-color (color count grows horizontally, steps are bounded; a rows orientation option flips it). Stage footer: "7 colors · 63 swatches" + quick Copy CSS / PNG buttons.

- Step cell click = copy hex + toast (aria-live). Base swatch click = SwatchEditor popover: hex field, native color input, L/C/H sliders, lock, duplicate, insert-after, remove. Drag-reorder on the base row.
- Narrow (<900px): sidebar becomes a drawer (`useMediaQuery`, `.is-drawer` class, body scroll lock); header secondary actions collapse into an overflow menu; step-label column sticky-left and base row sticky in vertical scroll; labels degrade hex-only → none below 480px.

### File tree (short form)

```
rainbow-generator\
  index.html  vite.config.js (base:'./')  package.json  .gitignore
  .github\workflows\deploy.yml   README.md  FEATURES.md  PLAN.md
  public\favicon.svg
  src\
    main.jsx  App.jsx  App.css
    context\AppContext.jsx
    data\params.js  data\presets.js (~12)  data\version.js
    hooks\usePalette.js  useKeyboard.js  useCopyFlag.js  useMediaQuery.js
    lib\   (engine layout above)  +  lib\export\{index,code,tailwind,tokens,svg,raster,download}.js
    lib\stateCodec.js  prng.js  randomize.js  storage.js
    components\
      Icon.jsx  Header\  Sidebar\(+Presets)  ControlSection\
      controls\{Control,SliderControl,SelectControl,SegmentedControl,ToggleControl,ColorControl,TextControl}.jsx
      Stage\(+StageToolbar)  PaletteGrid\{PaletteGrid,RainbowRow,StepCell}
      Swatch\  SwatchEditor\  PaletteImport\  ExportModal\(+CodePreview,ImageOptions)
      Toast\  Tooltip\
    styles\variables.css  themes.css  global.css
```

### Param registry (`src\data\params.js`)

Topo's registry shape plus: `hidden` (in state/URL/randomize but not sidebar-rendered — `paletteSource`, `customColors`), types `text`/`segmented`, and `disabledIf(settings)` (greys the Generator group in custom mode).

Groups and keys (defaults in parens, engine-verified):
- **Generator:** count (7, 2–24) · startHue (29°, 0–360) · hueSpread (281°, 30–360) · direction (cw) · lightnessMode (natural | flat) · lightness (72%, drives flat target / natural flatten blend) · chromaMode (vivid | even) · saturation (80%, → chromaFactor) · lightnessArc (0, ±50) · chromaArc (0, ±50) · hueEasing (linear | easeIn | easeOut | easeInOut)
- **Adjustments** (the "one family" dials; identical for both sources): unify (0–100%, drives hueConverge + chromaConverge together) · hueShift (0, ±180°) · temperature (0, ±100) · saturation (100, 0–200%, → chromaScale) · lightness (0, ±50%, → lightnessShift) · contrast (0, ±100, → lightnessSpread) · preserveNeutrals (on)
- **Steps:** stepPercent (10, 2–25%) · stepCount (4 each way, 0–9; 0 = bare rainbow row) · pastelTints (0–50%, → chromaTaper)
- **Display:** swatchShape (rounded) · swatchSize (88px, 48–160) · labelMode (value | name | none; "value" renders in the chosen colorFormat) · showStepLabels (on) · gridOrientation (columns | rows) · previewBackground (theme | white | black | checker) · contrastBadges (off)
- **Naming & format:** colorFormat (hex | rgb | rgba | hsl | hsla | hwb | oklch | oklab, default hex — drives code exports, swatch labels, and editor readouts) · namePrefix ('color') · nameStyle (hue | index) · stepNaming (scale 50–950 | percent)

`colorFormat` lives in the registry (so it's in the share URL and undo history) and is ALSO surfaced as a quick select inside the ExportModal writing the same param — one source of truth, two places to reach it.

Unify and contrast are deliberately non-overlapping: unify converges hue+chroma (the family feel), contrast owns lightness spread.

### State & persistence

- Topo's reducer verbatim in spirit: `UPDATE_PARAM` (live) / `COMMIT` / `SET_SETTINGS` / `RESET` / `RANDOMIZE` / `UNDO` / `REDO` / `SET_THEME`; past/future capped at 30; one slider drag = one undo entry.
- New palette actions: `FORK_TO_CUSTOM` · `SET_COLOR` (live, commit on blur/pointer-up) · `ADD_COLOR` (defaults to neighbor interpolation) · `REMOVE_COLOR` (no-op below 2) · `MOVE_COLOR` · `REPLACE_COLORS` (paste/sort/reverse/distribute) · `SET_SELECTED` (UI-only, not in history or URL).
- localStorage (`rainbow-*`): theme (seeded from prefers-color-scheme), sidebar section state, last export options. Settings persist via URL hash only (topo pattern).
- Share URL: topo codec + the array-safe diff fix + hex validation on decode. Optionally pack `customColors` as comma-joined hex sans `#` before base64 (24 colors ≈ 160 chars).

### Keyboard & a11y

`R` randomize · `Ctrl+Z`/`Ctrl+Y` · `E` export · `C` copy CSS · arrows move swatch selection · `Enter` edit · `Del` remove · `Esc` close. Guarded against firing in inputs. Per-swatch `aria-label` ("Color 3, #10b981, 20% lighter"), aria-live toast, `:focus-visible` rings, `prefers-reduced-motion` guard.

## Export formats

`lib\export\index.js` registry: `{ id, label, ext, mime, kind: 'text' | 'raster', build | render }` — text formats get copy + download, raster get download + clipboard-image (feature-detected).

**Preview-first modal.** The ExportModal is a live preview, not a blind download button: for every code format, `CodePreview` shows the exact file content in a scrollable `<pre>`, regenerated live as the palette, color unit, prefix, or naming options change; Copy and Download act on precisely what is shown. Image formats get the same treatment with a live rendered thumbnail (the raster/SVG layout drawn small) that honors scale, labels, and background options before downloading.

**Color unit.** Every code format emits values in the selected `colorFormat` via `color\format.js` — the same palette exports as `#e84739`, `rgb(232, 71, 57)`, `rgba(232, 71, 57, 1)`, `hsl(5deg, 79%, 57%)`, `hwb(5deg 22% 9%)`, or `oklch(0.62 0.191 29.2)` by flipping one select. JSON token `$value`s follow the unit too.

Samples (defaults: hex unit, hue names, 50–950 scale, `--rainbow-N` base aliases):

```css
:root {
  --rainbow-1: #ec5b4b;          /* base aliases, 1..N */
  --red-50: #ffa89b;             /* per-color scales   */
  --red-500: #e84739;
  --red-950: #630000;
}
```
```scss
$red-500: #e84739;
$red: (50: #ffa89b, 500: #e84739, 950: #630000);   // maps are why people pick SCSS
$rainbow: (1: #ec5b4b, 2: #e7aa4b);
```
LESS: `@red-500: #e84739;` · Tailwind v3: the `theme.extend.colors` nested object (toggle for full-file wrapper) · JSON: W3C DTCG (`{"red":{"500":{"$type":"color","$value":"#e84739"}}}`) with a flat `{name: hex}` toggle.

SVG swatch sheet: rows = colors, cols = steps; 120×96 cells, 8px gutter, 140px row-label gutter, 28px column header; hex text ink from `contrast.js`; built as a string array + `join('')` (renderSvg.js convention). Raster: same layout drawn to canvas at 1/2/3× scale, `canvas.toBlob` with topo's MIME map, JPG forced opaque, honors previewBackground.

CSS/SCSS/LESS share one descriptor table in `code.js` (prefix `--`/`$`/`@`, assignment, map syntax or none); Tailwind and tokens get their own small builders.

## Build order

Each milestone ends in a working `npm run dev`.

- **M0 Scaffold:** package.json (react, react-dom, 3 FontAwesome packages; dev: vite, plugin-react), vite.config base `'./'`, index.html (`data-theme="dark"`, real title/description), .gitignore, main.jsx, git init. Verify: heading renders.
- **M1 Tokens + shell:** copy/adapt topo variables/themes/global css (accent: a violet ~`#7c5cff`, neutral against every swatch; system font stack), AppContext theme-only, Header, Icon.jsx FA wrapper. Verify: theme toggle flips and survives reload.
- **M2 Registry + sidebar:** full params.js, getDefaults, controls + dispatcher + ControlSection, Sidebar with hidden/showIf/disabledIf + persisted section state, reducer core actions. Verify: every control mutates a JSON debug dump.
- **M3 Engine foundation + rainbow row:** `color\oklch.js` + `parse.js`, `rainbow.js`, minimal `palette.js`, usePalette, Stage + toolbar + RainbowRow. Verify: ROYGBIV matches the verified hexes; count/startHue/spread/saturation/lightness visibly drive the row.
- **M4 Tint/shade grid:** `scale.js`, `naming.js`, full PaletteGrid (sticky step labels, sticky base row), StepCell click-to-copy + Toast, Display group wired. Verify: stepCount 4 × stepPercent 10 = 9 rows at +40..−40; stepCount 0 collapses to the bare row.
- **M5 Custom palette:** fork/edit/add/remove/move/replace actions, SwatchEditor popover, PaletteImport paste modal, Sort/Reverse/Distribute, back-to-generated. Verify: editing swatch 3 forks to custom, other swatches unchanged, its ladder rebuilds.
- **M6 Harmonize:** `harmonize.js` + Adjustments wiring (the tuning-heavy part; needs the live preview from M5). Verify: saturation 0 goes gray gracefully; unify 100 visibly converges a clashing paste; grays survive untouched with preserveNeutrals on.
- **M7 Export:** export/* modules + `color\format.js` + download.js, ExportModal (format pills grouped Code/Image, live CodePreview with copy+download, live image thumbnail, colorFormat quick select, ImageOptions scale/layout/labels/background), per-format option persistence. Verify: all 9 formats produce output; downloaded CSS resolves in a scratch page; switching the color unit to HSL rewrites the visible preview instantly and the downloaded file matches it; JPG is opaque; naming controls reshape the preview live.
- **M8 History/URL/randomize/presets/keyboard:** past/future + buttons, stateCodec with the array fix, share link, prng+randomize, ~12 presets (ROYGBIV, Pastel, Neon, Earth, Retro 70s, Cyberpunk, Muted, Sunset, Forest, Candy, Corporate, Grayscale) as live CSS-gradient thumbnails, shortcuts. Verify: 30-step drag undoes in one step; URL round-trips a custom palette in a fresh tab.
- **M9 Responsive + polish + docs + deploy:** drawer sidebar, overflow menu, a11y pass (impeccable skill), README + FEATURES (humanizer pass at write time), favicon, hero.png from the real app, deploy.yml (keep the rm-lockfile step), PLAN.md at root. Verify: full keyboard-only flow at 375px; `npm run build && npm run preview` restores a hash link with relative paths.

## Verification (end-to-end)

1. Default view: 7 columns reading red→violet, 4 tint rows above, 4 shade rows below the ringed base row. Colors slider 2→24 reflows without overflow.
2. stepPercent 20 + stepCount 2 → labels +40/+20/0/−20/−40 and colors match by eye.
3. Saturation 0 → all gray, still legible. Unify 100 on a clashing paste (`#ff0000 #2b7a0b #c9c9c9 #00e5ff #ffd400 #3a0ca3`) → visibly one family, the gray still gray.
4. Edit base swatch 3 to `#123456` → source flips to Custom, six others untouched, ladder under 3 rebuilds. Back to generated restores the ramp; Ctrl+Z walks it all back one gesture at a time.
5. Paste `#ff0000 #00ff00, 0000ff` → 3 colors load, junk tokens reported not thrown.
6. Every cell click copies its hex with a toast; share URL round-trips in a new tab including custom colors.
7. All 9 exports: copy + download for code, download (+ clipboard where supported) for images; SVG opens in a browser; PNG matches the on-screen grid and previewBackground.
7b. Color units: with the CSS format selected, flip the unit hex → rgb → hsl → oklch; the preview rewrites each time BEFORE any download, the downloaded file matches the preview byte-for-byte, and each emitted value pasted into a browser devtools color field resolves to the same swatch. Swatch labels follow the unit when labelMode is "value".
8. Theme toggle: every surface flips; choice sticks after reload.
9. `R` five times in generated mode: always usable palettes. In custom mode: base colors survive, only adjustments change.
10. 375px viewport: drawer opens/closes, sticky column and base row hold during scroll, export reachable, keyboard-only flow works with visible focus rings.
11. `npm run build && npm run preview`: relative `./assets/` paths, hash link restores.

## Appendix: original prompt (verbatim)

> let's create a new project. We're going to make a rainbow generator. a normal rainbow is ROYGBIV (red, orange, yellow, green, blue, indigo, violet), but I want to be able to make a 15 colored rainbow. then also show 10% lighter, 20% lighter, etc. and the same for darker. I can also set a palette and then play with the filters, saturation, etc. until I get the perfect rainbow pallete so the colors all look like they're in the same family and work well together. I can then explort the CSS, an image, etc.
>
> the folder is here: C:\repos\rainbow-generator
