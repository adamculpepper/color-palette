// Starting points, not modes. A preset is a partial settings object that gets
// merged over whatever the user already has, so their color count, step ladder,
// display choices and naming survive the click and only the look changes.
//
// Every preset states the whole Generator arc and the whole Adjustments stack.
// Spelling out the neutral values matters: without them, a preset picked while
// Unify sits at 80 would inherit that and look nothing like its own thumbnail.
// Steps values appear only where the ladder is part of the look (pastel tints),
// and customColors is never touched, so switching back to a custom palette still
// finds the colors that were there.

const RAINBOW_ARC = {
  harmony: 'spectrum',
  startHue: 29,
  hueSpread: 281,
  direction: 'cw',
  lightnessMode: 'natural',
  lightness: 72,
  chromaMode: 'vivid',
  saturation: 80,
  lightnessArc: 0,
  chromaArc: 0,
  hueEasing: 'linear',
}

const NEUTRAL_ADJUSTMENTS = {
  unify: 0,
  hueShift: 0,
  temperature: 0,
  satScale: 100,
  lightShift: 0,
  contrast: 0,
  preserveNeutrals: true,
}

function preset(id, label, description, overrides) {
  return {
    id,
    label,
    description,
    settings: { ...RAINBOW_ARC, ...NEUTRAL_ADJUSTMENTS, ...overrides },
  }
}

// Order is display order, eight to a page. Each page mixes light against dark
// and loud against quiet rather than grouping all the pale ones together, so a
// page turn always shows a different kind of palette.
export const PRESETS = [
  // ---- Page 1: the range of the generator ----
  preset('roygbiv', 'ROYGBIV', 'The seven named colors, each on its own true hue', {
    harmony: 'spectral',
  }),

  preset('spectrum', 'Spectrum', 'Hues spaced evenly around the arc, amber where yellow would sit', {}),

  preset('pastel', 'Pastel', 'High lightness, low chroma, tints that fade toward white', {
    lightness: 86,
    saturation: 46,
    satScale: 82,
    lightShift: 6,
    pastelTints: 24,
  }),

  preset('neon', 'Neon', 'The named colors pushed to the edge of the sRGB gamut', {
    harmony: 'spectral',
    lightness: 74,
    saturation: 100,
    satScale: 138,
    contrast: 22,
  }),

  // Chroma is zero from both ends, so the only thing separating these swatches is
  // the per-hue lightness of the natural mode. The arc runs yellow to blue, the
  // stretch of the cusp curve that falls steadily, so the result reads as a ramp
  // rather than a random set of grays.
  preset('grayscale', 'Grayscale', 'No chroma at all, spread across lightness', {
    startHue: 110,
    hueSpread: 154,
    hueEasing: 'easeOut',
    saturation: 0,
    satScale: 0,
    contrast: 26,
  }),

  preset('muted', 'Muted', 'Full spectrum with the volume turned down', {
    lightness: 66,
    saturation: 34,
    satScale: 68,
    unify: 30,
  }),

  preset('midnight', 'Midnight', 'Deep blues and indigos, lit from a long way off', {
    startHue: 232,
    hueSpread: 96,
    lightness: 34,
    saturation: 64,
    temperature: -22,
    contrast: 20,
  }),

  preset('tropical', 'Tropical', 'Lime through turquoise, loud and wet', {
    startHue: 96,
    hueSpread: 118,
    lightness: 76,
    saturation: 96,
    satScale: 122,
  }),

  // ---- Page 2: drawn from the natural world ----
  preset('earth', 'Earth', 'A short warm arc through clay, ochre and moss', {
    startHue: 22,
    hueSpread: 110,
    lightness: 62,
    saturation: 48,
    satScale: 88,
    temperature: 26,
    unify: 14,
  }),

  preset('forest', 'Forest', 'Leaf green to deep teal, slightly compressed', {
    startHue: 122,
    hueSpread: 74,
    lightness: 56,
    saturation: 52,
    satScale: 92,
    temperature: 8,
    contrast: -8,
  }),

  preset('ocean', 'Ocean', 'Shallow aqua down into deep water', {
    startHue: 186,
    hueSpread: 104,
    lightness: 52,
    saturation: 68,
    temperature: -32,
    contrast: 18,
    lightnessArc: -14,
  }),

  preset('desert', 'Desert', 'Bleached sand and dry grass at midday', {
    startHue: 40,
    hueSpread: 86,
    lightness: 84,
    saturation: 26,
    satScale: 72,
    temperature: 30,
    unify: 34,
  }),

  preset('autumn', 'Autumn', 'Russet down to olive, the light nearly gone', {
    startHue: 30,
    hueSpread: 84,
    lightness: 44,
    saturation: 74,
    lightnessArc: -16,
    temperature: 30,
    contrast: 28,
  }),

  preset('moss', 'Moss', 'Deep damp green, close and dull', {
    harmony: 'analogous',
    startHue: 134,
    hueSpread: 44,
    lightness: 36,
    saturation: 32,
    satScale: 82,
    temperature: 8,
    unify: 32,
  }),

  preset('sage', 'Sage', 'Warm grey-greens with almost no colour left', {
    harmony: 'analogous',
    startHue: 118,
    hueSpread: 58,
    lightness: 62,
    saturation: 20,
    satScale: 66,
    temperature: 16,
    unify: 30,
  }),

  preset('clay', 'Clay', 'Terracotta, a narrow band pulled to one warmth', {
    startHue: 6,
    hueSpread: 38,
    lightness: 66,
    saturation: 50,
    temperature: 30,
    unify: 42,
  }),

  // ---- Page 3: mood and period ----
  preset('retro70s', 'Retro 70s', 'Burnt orange to avocado, dropped in the middle', {
    startHue: 18,
    hueSpread: 78,
    lightness: 63,
    saturation: 60,
    lightnessArc: -12,
    satScale: 95,
    temperature: 40,
    contrast: 14,
  }),

  preset('cyberpunk', 'Cyberpunk', 'Magenta down to cyan, cooled and cranked', {
    startHue: 292,
    hueSpread: 168,
    direction: 'ccw',
    lightness: 66,
    saturation: 96,
    satScale: 124,
    temperature: -34,
    contrast: 32,
  }),

  preset('vaporwave', 'Vaporwave', 'Hot pink against pool cyan, three hues only', {
    harmony: 'split',
    startHue: 328,
    lightness: 76,
    saturation: 86,
    temperature: -18,
  }),

  preset('ember', 'Ember', 'Low red heat with the fire nearly out', {
    startHue: 4,
    hueSpread: 36,
    lightness: 40,
    saturation: 94,
    temperature: 30,
    contrast: 26,
  }),

  preset('wine', 'Wine', 'Deep reds turning toward plum', {
    startHue: 344,
    hueSpread: 72,
    lightness: 40,
    saturation: 58,
    temperature: 8,
    contrast: 14,
  }),

  preset('dusk', 'Dusk', 'Violet into blue, the half hour after sunset', {
    startHue: 286,
    hueSpread: 108,
    lightness: 48,
    saturation: 46,
    temperature: -16,
    contrast: -12,
  }),

  preset('noir', 'Noir', 'One cold hue held near black', {
    harmony: 'monochrome',
    startHue: 248,
    lightness: 32,
    saturation: 22,
    contrast: 34,
  }),

  preset('acid', 'Acid', 'Yellow-greens turned up past comfortable', {
    startHue: 76,
    hueSpread: 68,
    lightness: 86,
    saturation: 100,
    satScale: 142,
    contrast: 20,
  }),

  // ---- Page 4: quiet, and made for interfaces ----
  preset('corporate', 'Corporate', 'Blue-led, even chroma, safe against white', {
    startHue: 264,
    hueSpread: 140,
    direction: 'ccw',
    chromaMode: 'even',
    lightness: 58,
    saturation: 42,
    satScale: 82,
    unify: 26,
    contrast: -12,
  }),

  preset('nordic', 'Nordic', 'Cool and pale, the light through a window in winter', {
    startHue: 198,
    hueSpread: 126,
    lightness: 82,
    saturation: 26,
    satScale: 72,
    unify: 26,
    temperature: -12,
  }),

  preset('slate', 'Slate', 'Blue-grey, barely coloured, built for text', {
    startHue: 214,
    hueSpread: 76,
    chromaMode: 'even',
    lightness: 56,
    saturation: 18,
    satScale: 68,
    unify: 42,
  }),

  preset('sorbet', 'Sorbet', 'Peach to raspberry, soft and cold', {
    harmony: 'analogous',
    startHue: 352,
    hueSpread: 78,
    lightness: 84,
    saturation: 62,
    satScale: 88,
    pastelTints: 18,
  }),

  preset('seaGlass', 'Sea Glass', 'Washed teals, as if left in the sun', {
    harmony: 'analogous',
    startHue: 168,
    hueSpread: 70,
    lightness: 86,
    saturation: 38,
    satScale: 78,
  }),

  preset('blush', 'Blush', 'Barely pink, the palest thing here', {
    harmony: 'analogous',
    startHue: 12,
    hueSpread: 48,
    lightness: 91,
    saturation: 22,
    satScale: 62,
    temperature: 16,
    unify: 30,
  }),

  preset('candy', 'Candy', 'A bright wrap from pink all the way round', {
    startHue: 322,
    hueSpread: 300,
    lightness: 80,
    saturation: 92,
    satScale: 112,
    pastelTints: 14,
  }),

  preset('warmSunset', 'Warm Sunset', 'Red through gold, brightest in the middle', {
    startHue: 18,
    hueSpread: 70,
    lightness: 70,
    saturation: 84,
    lightnessArc: 16,
    temperature: 44,
  }),

  // ---- Page 5: the wheel relationships, plus the loudest things here ----
  // The arc knobs are unread under an anchor harmony. They keep the values the
  // arc above uses so switching back to a sweep lands somewhere sane.
  preset('duotone', 'Duotone', 'Blue and amber from opposite sides of the wheel', {
    harmony: 'complementary',
    startHue: 258,
    lightness: 70,
    saturation: 78,
  }),

  preset('triad', 'Triad', 'Orange, emerald and indigo, an even third apart', {
    harmony: 'triad',
    startHue: 45,
    saturation: 72,
  }),

  preset('splitTone', 'Split', 'One hue against the two either side of its opposite', {
    harmony: 'split',
    startHue: 196,
    lightness: 64,
    saturation: 74,
    contrast: 16,
  }),

  preset('tetrad', 'Tetrad', 'Four hues, a quarter of the wheel apart', {
    harmony: 'tetrad',
    startHue: 132,
    lightness: 62,
    saturation: 72,
  }),

  preset('monochrome', 'Monochrome', 'A single violet stepped through lightness', {
    harmony: 'monochrome',
    startHue: 288,
    lightness: 64,
    saturation: 88,
    contrast: 26,
  }),

  preset('arcade', 'Arcade', 'Four primaries at full volume, nothing blended', {
    harmony: 'tetrad',
    startHue: 28,
    lightness: 66,
    saturation: 100,
    satScale: 132,
    contrast: 26,
  }),

  preset('highlighter', 'Highlighter', 'The brightest the screen can go and stay legible', {
    startHue: 62,
    hueSpread: 214,
    lightness: 88,
    saturation: 100,
    satScale: 148,
  }),

  preset('copper', 'Copper', 'Dark metallic browns, every hue held to one chroma', {
    harmony: 'analogous',
    startHue: 32,
    hueSpread: 44,
    chromaMode: 'even',
    lightness: 36,
    saturation: 74,
    temperature: 46,
    contrast: 26,
  }),
]

// Four rows of two in the sidebar. The list divides evenly by this, which the
// engine fixture asserts, so a page turn never lands on a stray row.
export const PRESETS_PER_PAGE = 8

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((entry) => [entry.id, entry]))
