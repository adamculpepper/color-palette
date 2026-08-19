// PARAM_REGISTRY is the single source of truth for every knob. It drives:
//   - the sidebar controls UI
//   - default values
//   - randomize bounds (randomize:true, optional randomMin/randomMax/randomValues)
//   - the share-URL codec (diff against defaults)
//
// Each entry: { key, group, type, label, default, min, max, step, unit, options,
//   randomize, randomMin, randomMax, randomValues, showIf, disabledIf, hidden, help }
// type: 'slider' | 'select' | 'segmented' | 'toggle' | 'color' | 'text' | 'colors'
//
// hidden      — lives in state, history and the share URL, but is never rendered
//               in the sidebar (the stage toolbar and swatch editor own it).
// disabledIf  — rendered greyed out rather than removed, so the generator knobs
//               stay visible while a custom palette is driving the grid.
// showIf      — removed from the sidebar entirely, for knobs the current mode
//               does not read at all (the hue arc under a harmony mode).

export const GROUPS = ['Generator', 'Adjustments', 'Steps', 'Display', 'Naming']

const isCustomPalette = (settings) => settings.paletteSource === 'custom'

// Spectrum and analogous walk an arc of the wheel, so the arc knobs mean
// something. The harmony modes place their colors on fixed anchors and never
// read spread, direction or easing.
const SPREAD_HARMONIES = new Set(['spectrum', 'analogous'])
const PATH_HARMONIES = new Set(['spectrum', 'spectral', 'analogous'])
// The spread slider only means something where the arc is the user's to set.
const readsHueSpread = (settings) => SPREAD_HARMONIES.has(settings.harmony)
// Direction and easing apply to anything that walks a path, named or swept.
const walksHuePath = (settings) => PATH_HARMONIES.has(settings.harmony)

export const PARAM_REGISTRY = [
  // ---- Generator ----
  {
    key: 'harmony', group: 'Generator', type: 'select', label: 'Harmony',
    default: 'spectrum',
    options: [
      { value: 'spectrum', label: 'Spectrum (even sweep)' },
      { value: 'spectral', label: 'True rainbow (ROYGBIV)' },
      { value: 'analogous', label: 'Analogous' },
      { value: 'complementary', label: 'Complementary' },
      { value: 'split', label: 'Split complementary' },
      { value: 'triad', label: 'Triad' },
      { value: 'tetrad', label: 'Tetrad' },
      { value: 'monochrome', label: 'Monochrome' },
    ],
    randomize: true,
    // Weighted: a roll should still usually be a rainbow, and an anchor mode
    // should be the surprise rather than the norm.
    randomValues: [
      'spectrum', 'spectrum', 'spectral', 'spectral',
      'analogous', 'analogous', 'analogous',
      'complementary', 'split', 'triad', 'tetrad', 'monochrome',
    ],
    disabledIf: isCustomPalette,
    help: 'Spectrum spaces the colors evenly along an arc. True rainbow puts them on the seven named spectral hues, so yellow is really yellow. The rest use the classic wheel relationships.',
  },
  {
    key: 'count', group: 'Generator', type: 'slider', label: 'Colors',
    default: 7, min: 2, max: 24, step: 1, disabledIf: isCustomPalette,
    help: 'How many base colors the rainbow spans. 7 is ROYGBIV.',
  },
  {
    key: 'startHue', group: 'Generator', type: 'slider', label: 'Start hue',
    default: 29, min: 0, max: 360, step: 1, unit: '°',
    randomize: true, disabledIf: isCustomPalette,
    help: 'Hue of the first color. 29° is a true red.',
  },
  {
    key: 'hueSpread', group: 'Generator', type: 'slider', label: 'Hue spread',
    default: 281, min: 30, max: 360, step: 1, unit: '°',
    randomize: true, randomMin: 140, randomMax: 330,
    disabledIf: isCustomPalette, showIf: readsHueSpread,
    help: 'How far around the wheel the rainbow travels. 360 wraps into a full color wheel. Analogous caps it at 90.',
  },
  {
    key: 'direction', group: 'Generator', type: 'select', label: 'Direction',
    default: 'cw',
    options: [
      { value: 'cw', label: 'Clockwise' },
      { value: 'ccw', label: 'Counter-clockwise' },
    ],
    randomize: true, disabledIf: isCustomPalette, showIf: walksHuePath,
  },
  {
    key: 'lightnessMode', group: 'Generator', type: 'select', label: 'Lightness mode',
    default: 'natural',
    options: [
      { value: 'natural', label: 'Natural (per hue)' },
      { value: 'flat', label: 'Flat' },
    ],
    randomize: true, randomValues: ['natural', 'natural', 'flat'], disabledIf: isCustomPalette,
    help: 'Natural follows the peak lightness of each hue, so yellow stays yellow instead of going brown.',
  },
  {
    key: 'lightness', group: 'Generator', type: 'slider', label: 'Lightness',
    default: 72, min: 5, max: 95, step: 1, unit: '%',
    randomize: true, randomMin: 60, randomMax: 84, disabledIf: isCustomPalette,
  },
  {
    key: 'chromaMode', group: 'Generator', type: 'select', label: 'Chroma mode',
    default: 'vivid',
    options: [
      { value: 'vivid', label: 'Vivid per hue' },
      { value: 'even', label: 'Even across hues' },
    ],
    randomize: true, disabledIf: isCustomPalette,
    help: 'Even holds every hue to the same chroma, which costs punch but reads as one set.',
  },
  {
    key: 'saturation', group: 'Generator', type: 'slider', label: 'Saturation',
    default: 80, min: 0, max: 100, step: 1, unit: '%',
    randomize: true, randomMin: 55, randomMax: 95, disabledIf: isCustomPalette,
  },
  {
    key: 'lightnessArc', group: 'Generator', type: 'slider', label: 'Lightness arc',
    default: 0, min: -50, max: 50, step: 1,
    randomize: true, randomMin: -20, randomMax: 20, disabledIf: isCustomPalette,
    help: 'Bows lightness across the sweep so the middle colors sit higher or lower than the ends.',
  },
  {
    key: 'chromaArc', group: 'Generator', type: 'slider', label: 'Chroma arc',
    default: 0, min: -50, max: 50, step: 1,
    randomize: true, randomMin: -20, randomMax: 20, disabledIf: isCustomPalette,
    help: 'Same bow applied to chroma.',
  },
  {
    key: 'hueEasing', group: 'Generator', type: 'select', label: 'Hue easing',
    default: 'linear',
    options: [
      { value: 'linear', label: 'Linear' },
      { value: 'easeIn', label: 'Ease in' },
      { value: 'easeOut', label: 'Ease out' },
      { value: 'easeInOut', label: 'Ease in and out' },
    ],
    randomize: true, disabledIf: isCustomPalette, showIf: walksHuePath,
    help: 'Bunches the hue steps toward one end of the sweep instead of spacing them evenly.',
  },
  {
    key: 'paletteSource', group: 'Generator', type: 'select', label: 'Palette source',
    default: 'generated', hidden: true,
    options: [
      { value: 'generated', label: 'Generated' },
      { value: 'custom', label: 'Custom' },
    ],
  },
  {
    key: 'customColors', group: 'Generator', type: 'colors', label: 'Custom colors',
    default: [], hidden: true,
  },

  // ---- Adjustments (identical for generated and custom palettes) ----
  {
    key: 'unify', group: 'Adjustments', type: 'slider', label: 'Unify',
    default: 0, min: 0, max: 100, step: 1, unit: '%',
    randomize: true, randomMin: 0, randomMax: 45,
    help: 'Pulls hue and chroma toward the palette average so clashing colors read as one family.',
  },
  {
    key: 'hueShift', group: 'Adjustments', type: 'slider', label: 'Hue shift',
    default: 0, min: -180, max: 180, step: 1, unit: '°',
    randomize: true, randomMin: -40, randomMax: 40,
  },
  {
    key: 'temperature', group: 'Adjustments', type: 'slider', label: 'Temperature',
    default: 0, min: -100, max: 100, step: 1,
    randomize: true, randomMin: -45, randomMax: 45,
    help: 'Warms or cools every color without rotating its hue.',
  },
  {
    key: 'satScale', group: 'Adjustments', type: 'slider', label: 'Saturation',
    default: 100, min: 0, max: 200, step: 1, unit: '%',
    randomize: true, randomMin: 80, randomMax: 130,
    help: '0 takes the palette all the way to gray.',
  },
  {
    key: 'lightShift', group: 'Adjustments', type: 'slider', label: 'Lightness',
    default: 0, min: -50, max: 50, step: 1, unit: '%',
    randomize: true, randomMin: -12, randomMax: 12,
  },
  {
    key: 'contrast', group: 'Adjustments', type: 'slider', label: 'Contrast',
    default: 0, min: -100, max: 100, step: 1,
    randomize: true, randomMin: -25, randomMax: 35,
    help: 'Fans the lightness values apart, or compresses them toward the average.',
  },
  {
    // Deliberately not randomizable: this is a correctness guard, not a look.
    key: 'preserveNeutrals', group: 'Adjustments', type: 'toggle', label: 'Preserve neutrals',
    default: true,
    help: 'Leaves near-gray colors alone when the hue and chroma filters run.',
  },

  // ---- Steps ----
  {
    key: 'stepPercent', group: 'Steps', type: 'slider', label: 'Step size',
    default: 10, min: 2, max: 25, step: 1, unit: '%',
    help: 'Each step moves this far toward white or black, measured from what is left.',
  },
  {
    key: 'stepCount', group: 'Steps', type: 'slider', label: 'Steps each way',
    default: 5, min: 0, max: 9, step: 1,
    help: 'At 10% steps, 9 runs the full ladder. 0 leaves the bare rainbow row.',
  },
  {
    key: 'pastelTints', group: 'Steps', type: 'slider', label: 'Pastel tints',
    default: 0, min: 0, max: 50, step: 1, unit: '%',
    help: 'Drains chroma as tints get lighter, the classic pastel ladder.',
  },

  // ---- Display ----
  {
    key: 'swatchShape', group: 'Display', type: 'segmented', label: 'Swatch shape',
    default: 'rounded',
    options: [
      { value: 'square', label: 'Square' },
      { value: 'rounded', label: 'Rounded' },
      { value: 'circle', label: 'Circle' },
    ],
  },
  {
    key: 'swatchSize', group: 'Display', type: 'slider', label: 'Swatch size',
    default: 88, min: 48, max: 160, step: 4, unit: 'px',
  },
  {
    key: 'labelMode', group: 'Display', type: 'select', label: 'Swatch labels',
    default: 'value',
    options: [
      { value: 'value', label: 'Color value' },
      { value: 'name', label: 'Name' },
      { value: 'none', label: 'None' },
    ],
    help: 'Color value follows whatever format the Naming group is set to.',
  },
  {
    key: 'showStepLabels', group: 'Display', type: 'toggle', label: 'Step labels',
    default: true,
  },
  {
    key: 'gridOrientation', group: 'Display', type: 'segmented', label: 'Layout',
    default: 'columns',
    options: [
      { value: 'columns', label: 'Columns' },
      { value: 'rows', label: 'Rows' },
    ],
  },
  {
    key: 'previewBackground', group: 'Display', type: 'select', label: 'Preview background',
    default: 'theme',
    options: [
      { value: 'theme', label: 'Theme' },
      { value: 'white', label: 'White' },
      { value: 'black', label: 'Black' },
      { value: 'checker', label: 'Checker' },
    ],
  },
  {
    key: 'contrastBadges', group: 'Display', type: 'toggle', label: 'Contrast badges',
    default: false,
    help: 'Shows the WCAG ratio of each swatch against its own label ink.',
  },

  // ---- Naming ----
  {
    key: 'colorFormat', group: 'Naming', type: 'select', label: 'Color format',
    default: 'hex',
    options: [
      { value: 'hex', label: 'Hex' },
      { value: 'rgb', label: 'rgb()' },
      { value: 'rgba', label: 'rgba()' },
      { value: 'hsl', label: 'hsl()' },
      { value: 'hsla', label: 'hsla()' },
      { value: 'hwb', label: 'hwb()' },
      { value: 'oklch', label: 'oklch()' },
      { value: 'oklab', label: 'oklab()' },
    ],
    help: 'Drives code exports, swatch labels and the editor readouts at once.',
  },
  {
    key: 'namePrefix', group: 'Naming', type: 'text', label: 'Name prefix',
    default: 'color', maxLength: 24,
    help: 'Used for index-style names and the base aliases in exports.',
  },
  {
    key: 'nameStyle', group: 'Naming', type: 'select', label: 'Name style',
    default: 'hue',
    options: [
      { value: 'hue', label: 'By hue (red, teal)' },
      { value: 'index', label: 'By index (color-1)' },
    ],
  },
  {
    key: 'stepNaming', group: 'Naming', type: 'select', label: 'Step names',
    default: 'scale',
    options: [
      { value: 'scale', label: 'Scale (50 to 950)' },
      { value: 'percent', label: 'Percent (l10, d20)' },
    ],
  },
]

export const PARAM_BY_KEY = Object.fromEntries(PARAM_REGISTRY.map((param) => [param.key, param]))

export function getDefaults() {
  const defaults = {}
  for (const param of PARAM_REGISTRY) {
    defaults[param.key] = Array.isArray(param.default) ? [...param.default] : param.default
  }
  return defaults
}

// Decimal precision implied by a step (0.05 -> 2), for clean rounding.
export function stepPrecision(step) {
  if (!step || Number.isInteger(step)) return 0
  const text = String(step)
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}
