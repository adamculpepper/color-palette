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

export const PRESETS = [
  preset('roygbiv', 'ROYGBIV', 'The classic spectrum, red through violet', {}),

  preset('pastel', 'Pastel', 'High lightness, low chroma, tints that fade toward white', {
    lightness: 86,
    saturation: 46,
    satScale: 82,
    lightShift: 6,
    pastelTints: 24,
  }),

  preset('neon', 'Neon', 'Every hue pushed to the edge of the sRGB gamut', {
    lightness: 74,
    saturation: 100,
    satScale: 138,
    contrast: 22,
  }),

  preset('earth', 'Earth', 'A short warm arc through clay, ochre and moss', {
    startHue: 22,
    hueSpread: 110,
    lightness: 62,
    saturation: 48,
    satScale: 88,
    temperature: 26,
    unify: 14,
  }),

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

  preset('muted', 'Muted', 'Full spectrum with the volume turned down', {
    lightness: 66,
    saturation: 34,
    satScale: 68,
    unify: 30,
  }),

  preset('warmSunset', 'Warm Sunset', 'Red through gold, brightest in the middle', {
    startHue: 18,
    hueSpread: 70,
    lightness: 70,
    saturation: 84,
    lightnessArc: 16,
    temperature: 44,
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

  preset('candy', 'Candy', 'A bright wrap from pink all the way round', {
    startHue: 322,
    hueSpread: 300,
    lightness: 80,
    saturation: 92,
    satScale: 112,
    pastelTints: 14,
  }),

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

  // The two harmony presets. Spread and direction are still stated by the shared
  // arc above and still travel with the click, they just sit unread while an
  // anchor mode is picked, so switching back to spectrum lands somewhere sane.
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
]

export const PRESET_BY_ID = Object.fromEntries(PRESETS.map((entry) => [entry.id, entry]))
