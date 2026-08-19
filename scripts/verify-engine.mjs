// Engine fixture: runs the color engine end to end and asserts the behaviour the
// plan pins down. No dependencies, no dev server.
//   node scripts/verify-engine.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  NEUTRAL_CHROMA_THRESHOLD,
  hexToOklch,
  hexToRgb,
  isInGamut,
  hueDelta,
  maxChroma,
  normalizeHue,
} from '../src/lib/color/oklch.js'
import { formatColor } from '../src/lib/color/format.js'
import { normalizeHex, parseColorList } from '../src/lib/color/parse.js'
import { contrastRatio, readableTextOn } from '../src/lib/color/contrast.js'
import { harmonize } from '../src/lib/harmonize.js'
import { hueName, sanitizeLabel, tokenScale } from '../src/lib/naming.js'
import { DEFAULT_PALETTE_SETTINGS, buildPalette } from '../src/lib/palette.js'
import { distributeEvenly, reverseColors } from '../src/lib/paletteOps.js'
import { ANALOGOUS_MAX_SPREAD, DEFAULT_START_HUE, HARMONY_OFFSETS, SWEEP_HARMONIES, PATH_HARMONIES, SPECTRAL_HUE_OFFSETS } from '../src/lib/rainbow.js'
import { PARAM_BY_KEY, PARAM_REGISTRY } from '../src/data/params.js'
import { PRESETS, PRESETS_PER_PAGE } from '../src/data/presets.js'
import { coerceParamValue } from '../src/lib/stateCodec.js'

const LIB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib')
const HEX_PATTERN = /^#[0-9a-f]{6}$/

let failures = 0
let checks = 0

function section(title) {
  console.log(`\n${title}`)
  console.log('-'.repeat(title.length))
}

function check(label, passed, detail = '') {
  checks += 1
  if (!passed) failures += 1
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
}

function round(value, places = 4) {
  return Number(value.toFixed(places))
}

function spread(values) {
  return Math.max(...values) - Math.min(...values)
}

function hueSpread(hues) {
  let widest = 0
  for (const from of hues) {
    for (const to of hues) widest = Math.max(widest, Math.abs(hueDelta(from, to)))
  }
  return widest
}

function channelDelta(hexA, hexB) {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
}

function nearestStop(colors, hue) {
  return colors.reduce((closest, color) => (
    Math.abs(hueDelta(color.base.H, hue)) < Math.abs(hueDelta(closest.base.H, hue)) ? color : closest
  ), colors[0])
}

// 1. The even sweep ----------------------------------------------------------
section('1. The even 7-color sweep')

const REFERENCE_RAINBOW = ['#ec5b4b', '#e7aa4b', '#bce158', '#5ce2b8', '#54c9e6', '#4276e6', '#b25ce9']
// Asked for by name rather than taken from the defaults: the app now lands on
// the true rainbow, but these are the numbers the even sweep has always made.
const defaultPalette = buildPalette({ harmony: 'spectrum' })
const defaultHexes = defaultPalette.colors.map((color) => color.hex)
const defaultHues = defaultPalette.colors.map((color) => color.base.H)

console.log(`  engine    ${defaultHexes.join(' ')}`)
console.log(`  plan ref  ${REFERENCE_RAINBOW.join(' ')}`)
console.log(`  names     ${defaultPalette.colors.map((color) => color.name).join(' ')}`)
console.log(`  hues      ${defaultHues.map((hue) => hue.toFixed(1)).join(' ')}`)
console.log(`  L         ${defaultPalette.colors.map((color) => round(color.base.L, 3)).join(' ')}`)

check('7 colors', defaultHexes.length === 7)
check('all lowercase 6-digit hex', defaultHexes.every((hex) => HEX_PATTERN.test(hex)))
check('all base colors inside sRGB', defaultPalette.colors.every((color) => isInGamut(color.base)))
check(
  'hues progress strictly along the arc',
  defaultHues.every((hue, index) => index === 0 || hue > defaultHues[index - 1]),
  defaultHues.map((hue) => hue.toFixed(1)).join(' > '),
)
check('first stop is red near 29deg', Math.abs(hueDelta(defaultHues[0], 29)) < 2 && hueName(defaultHues[0], 1) === 'red', `H=${defaultHues[0].toFixed(2)}`)
check('last stop is violet near 310deg', Math.abs(hueDelta(defaultHues[6], 310)) < 2 && hueName(defaultHues[6], 1) === 'violet', `H=${defaultHues[6].toFixed(2)}`)

const rainbowDrift = defaultHexes.map((hex, index) => channelDelta(hex, REFERENCE_RAINBOW[index]))
check(
  'within 4/255 per channel of the plan reference',
  Math.max(...rainbowDrift) <= 4,
  `max channel delta ${Math.max(...rainbowDrift)} (${rainbowDrift.join(',')})`,
)

// 2. Natural lightness -------------------------------------------------------
section('2. Natural lightness follows the gamut cusp')

const yellowStop = nearestStop(defaultPalette.colors, 110)
const blueStop = nearestStop(defaultPalette.colors, 264)
const lightnesses = defaultPalette.colors.map((color) => color.base.L)

console.log(`  yellow region  ${yellowStop.hex}  H=${yellowStop.base.H.toFixed(1)}  L=${round(yellowStop.base.L, 3)}`)
console.log(`  blue region    ${blueStop.hex}  H=${blueStop.base.H.toFixed(1)}  L=${round(blueStop.base.L, 3)}`)

check('yellow-region stop is the lightest', yellowStop.base.L === Math.max(...lightnesses))
check('blue-region stop is the darkest', blueStop.base.L === Math.min(...lightnesses))

const flatPalette = buildPalette({ lightnessMode: 'flat' })
const flatLightnesses = flatPalette.colors.map((color) => color.base.L)
check('flat mode holds one lightness', spread(flatLightnesses) < 1e-9, `L=${round(flatLightnesses[0], 3)}`)

// 3. Ladder ------------------------------------------------------------------
section('3. Ladder for #e84739, 10% steps to +/-50%')

const ladderPalette = buildPalette({
  paletteSource: 'custom',
  customColors: ['#e84739'],
  stepPercent: 10,
  stepCount: 5,
})
const ladder = ladderPalette.colors[0].steps
const ladderBaseHue = ladderPalette.colors[0].base.H

for (const step of ladder) {
  const measured = hexToOklch(step.hex)
  console.log(
    `  ${String(step.pct > 0 ? `+${step.pct}` : step.pct).padStart(4)}%  ${step.hex}  ` +
    `L=${round(measured.L, 3).toFixed(3)}  C=${round(measured.C, 3).toFixed(3)}  ` +
    `H=${measured.H.toFixed(1).padStart(5)}  ${step.token}${step.collapsed ? '  collapsed' : ''}`,
  )
}
console.log(`  plan ref  +50 #ffa89b   0 #e84739   -50 #630000`)

const ladderLightness = ladder.map((step) => hexToOklch(step.hex).L)
check('lightness is strictly monotonic', ladderLightness.every((L, index) => index === 0 || L < ladderLightness[index - 1]))
check('base step round-trips to #e84739', ladder.find((step) => step.isBase).hex === '#e84739')
check('no step reaches pure white or black', ladder.every((step) => step.hex !== '#ffffff' && step.hex !== '#000000'))

const ladderHueDrift = ladder
  .map((step) => hexToOklch(step.hex))
  .filter((color) => color.C >= NEUTRAL_CHROMA_THRESHOLD)
  .map((color) => Math.abs(hueDelta(ladderBaseHue, color.H)))
check('hue drift under 2deg across the ladder', Math.max(...ladderHueDrift) < 2, `max ${round(Math.max(...ladderHueDrift), 2)}deg`)
check('ends are close to the plan reference', channelDelta(ladder[0].hex, '#ffa89b') <= 4 && channelDelta(ladder[ladder.length - 1].hex, '#630000') <= 4)

// 4. Harmonize ---------------------------------------------------------------
section('4. Harmonize')

const CLASHING = ['#ff0000', '#2b7a0b', '#c9c9c9', '#00e5ff', '#ffd400', '#3a0ca3']
const clashSettings = { paletteSource: 'custom', customColors: CLASHING }
const before = buildPalette(clashSettings)
const after = buildPalette({ ...clashSettings, unify: 100 })

const chromatic = (palette) => palette.colors.filter((color) => color.base.C >= NEUTRAL_CHROMA_THRESHOLD)

// How far apart the colors sit on the OKLab a/b plane, averaged over every
// pair: the objective reading of "do these look like one family".
function meanChromaticDistance(colors) {
  const points = colors.map((color) => ({
    a: color.base.C * Math.cos((color.base.H * Math.PI) / 180),
    b: color.base.C * Math.sin((color.base.H * Math.PI) / 180),
  }))
  let total = 0
  let pairs = 0
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      total += Math.hypot(points[i].a - points[j].a, points[i].b - points[j].b)
      pairs += 1
    }
  }
  return pairs ? total / pairs : 0
}

const chromaSpreadBefore = spread(chromatic(before).map((color) => color.base.C))
const chromaSpreadAfter = spread(chromatic(after).map((color) => color.base.C))
const hueSpreadBefore = hueSpread(chromatic(before).map((color) => color.base.H))
const hueSpreadAfter = hueSpread(chromatic(after).map((color) => color.base.H))
const lightnessSpreadBefore = spread(before.colors.map((color) => color.base.L))
const lightnessSpreadAfter = spread(after.colors.map((color) => color.base.L))
const familyBefore = meanChromaticDistance(chromatic(before))
const familyAfter = meanChromaticDistance(chromatic(after))

console.log(`  before  ${before.colors.map((color) => color.hex).join(' ')}`)
console.log(`  unify   ${after.colors.map((color) => color.hex).join(' ')}`)
console.log(`  chroma spread     ${round(chromaSpreadBefore, 3)} -> ${round(chromaSpreadAfter, 3)}  (the floor is gamut headroom at each lightness)`)
console.log(`  hue spread        ${round(hueSpreadBefore, 1)}deg -> ${round(hueSpreadAfter, 1)}deg`)
console.log(`  lightness spread  ${round(lightnessSpreadBefore, 3)} -> ${round(lightnessSpreadAfter, 3)}  (unify owns hue+chroma only)`)
console.log(`  mean a/b distance ${round(familyBefore, 3)} -> ${round(familyAfter, 3)}`)

check('unify compresses chroma spread', chromaSpreadAfter < chromaSpreadBefore)
check('unify collapses hue spread', hueSpreadAfter < 1, `${round(hueSpreadAfter, 2)}deg`)
check('unify pulls the palette into one family', familyAfter < familyBefore * 0.3, `${round(familyAfter / familyBefore, 3)}x`)
check('unify leaves lightness spread alone', Math.abs(lightnessSpreadAfter - lightnessSpreadBefore) < 1e-9)

const grayIndex = CLASHING.indexOf('#c9c9c9')
check('gray survives unify untouched', after.colors[grayIndex].hex === '#c9c9c9', after.colors[grayIndex].hex)
check('gray is named gray', after.colors[grayIndex].name === 'gray')

const grayScaled = buildPalette({ ...clashSettings, satScale: 180, unify: 60 })
check('gray survives chromaScale + chromaConverge', grayScaled.colors[grayIndex].hex === '#c9c9c9', grayScaled.colors[grayIndex].hex)

const grayUnguarded = buildPalette({ ...clashSettings, unify: 100, preserveNeutrals: false })
check(
  'preserveNeutrals off does move the gray (guard is load-bearing)',
  grayUnguarded.colors[grayIndex].hex !== '#c9c9c9',
  grayUnguarded.colors[grayIndex].hex,
)

const everyFilter = {
  hueRotate: 137,
  hueConverge: 1,
  temperature: 1,
  chromaScale: 1.6,
  chromaConverge: 1,
  lightnessShift: 0.12,
  lightnessSpread: -1,
  preserveNeutrals: true,
}
const singleColor = harmonize([hexToOklch('#e84739')], everyFilter)
const singleNeutral = harmonize([hexToOklch('#c9c9c9')], everyFilter)
const singleFinite = [...singleColor, ...singleNeutral]
  .every((color) => Number.isFinite(color.L) && Number.isFinite(color.C) && Number.isFinite(color.H))
console.log(`  single color through every filter  ${formatColor(singleColor[0], 'hex')} / neutral ${formatColor(singleNeutral[0], 'hex')}`)
check('single-color palette produces no NaN', singleFinite)
check('empty palette harmonizes to an empty palette', harmonize([], everyFilter).length === 0)

const desaturated = buildPalette({ satScale: 0 })
check('saturation 0 goes gray without breaking', desaturated.colors.every((color) => color.base.C < NEUTRAL_CHROMA_THRESHOLD && HEX_PATTERN.test(color.hex)))

// 5. Edge cases --------------------------------------------------------------
section('5. Edge cases')

const single = buildPalette({ count: 1 })
console.log(`  count 1        ${single.colors.map((color) => color.hex).join(' ')}`)
check('count 1 builds one usable color', single.colors.length === 1 && HEX_PATTERN.test(single.colors[0].hex))

// A full-circle span is a sweep behaviour, so it is asked for by name now that
// the default harmony walks a fixed path and ignores the spread.
const wheel = buildPalette({ harmony: 'spectrum', hueSpread: 360, count: 6 })
const wheelHues = wheel.colors.map((color) => color.base.H)
console.log(`  span 360       ${wheel.colors.map((color) => color.hex).join(' ')}`)
check('span 360 keeps first and last distinct', wheel.colors[0].hex !== wheel.colors[5].hex)
check('span 360 divides by count', Math.abs(Math.abs(hueDelta(wheelHues[0], wheelHues[1])) - 60) < 0.01)

const nearWhite = buildPalette({ paletteSource: 'custom', customColors: ['#fafafa'], stepPercent: 10, stepCount: 4 })
const nearWhiteSteps = nearWhite.colors[0].steps
console.log(`  #fafafa ladder ${nearWhiteSteps.map((step) => `${step.hex}${step.collapsed ? '*' : ''}`).join(' ')}   (* = collapsed)`)
const unflaggedDuplicate = nearWhiteSteps.some((step, index) => index > 0 && step.hex === nearWhiteSteps[index - 1].hex && !step.collapsed && !nearWhiteSteps[index - 1].collapsed)
check('near-white ladder flags its collapsed steps', nearWhiteSteps.some((step) => step.collapsed))
check('no duplicate step goes unflagged', !unflaggedDuplicate)

const nearBlack = buildPalette({ paletteSource: 'custom', customColors: ['#050505'], stepPercent: 10, stepCount: 4 })
check('near-black ladder stays valid', nearBlack.colors[0].steps.every((step) => HEX_PATTERN.test(step.hex)))

const bareRow = buildPalette({ stepCount: 0 })
check('stepCount 0 collapses to the base row', bareRow.colors.every((color) => color.steps.length === 1 && color.steps[0].isBase))

const extremeLadder = buildPalette({ stepPercent: 25, stepCount: 9 })
const extremeSteps = extremeLadder.colors[0].steps
check(
  'a ladder past the 95% stop stays valid and flags its repeats',
  extremeSteps.every((step) => HEX_PATTERN.test(step.hex)) && extremeSteps.some((step) => step.collapsed),
  `${extremeSteps.length} steps, ${extremeSteps.filter((step) => step.collapsed).length} collapsed`,
)

const generatorSweep = []
for (const direction of ['cw', 'ccw']) {
  for (const hueEasing of ['linear', 'easeIn', 'easeOut', 'easeInOut']) {
    for (const [lightnessArc, chromaArc] of [[0, 0], [50, 50], [-50, -50]]) {
      const swept = buildPalette({ direction, hueEasing, lightnessArc, chromaArc, count: 12 })
      const valid = swept.colors.length === 12
        && swept.colors.every((color) => HEX_PATTERN.test(color.hex) && isInGamut(color.base))
      if (!valid) generatorSweep.push(`${direction}/${hueEasing}/${lightnessArc}`)
    }
  }
}
check('every direction, easing and arc combination stays in gamut', generatorSweep.length === 0, generatorSweep.join(' '))

const displayKeys = {
  swatchShape: 'rounded', swatchSize: 88, labelMode: 'value', showStepLabels: true,
  gridOrientation: 'columns', previewBackground: 'theme', contrastBadges: false,
}
check(
  'display-only keys do not reach the engine',
  JSON.stringify(buildPalette({ ...displayKeys, count: 5 })) === JSON.stringify(buildPalette({ count: 5 })),
)

const parsed = parseColorList('#ff0000 #00ff00, 0000ff\nnot-a-color rgb(12, 34, 56)')
console.log(`  paste parse    ${parsed.colors.join(' ')}   rejected: ${parsed.rejected.map((entry) => `${entry.token}@line${entry.line}`).join(' ')}`)
check('paste keeps the four real colors', parsed.colors.join(' ') === '#ff0000 #00ff00 #0000ff #0c2238')
check('paste reports junk with its line', parsed.rejected.length === 1 && parsed.rejected[0].line === 2)
check('normalizeHex handles short and long forms', normalizeHex('#f00') === '#ff0000' && normalizeHex('#F00') === '#ff0000' && normalizeHex('ff0000') === '#ff0000' && normalizeHex('rgb(255 0 0)') === '#ff0000' && normalizeHex('nope') === null)

const emptyCustom = buildPalette({ paletteSource: 'custom', customColors: [] })
check('empty custom palette falls back to generated', emptyCustom.source === 'generated' && emptyCustom.colors.length === 7)

// 6. Formatting --------------------------------------------------------------
section('6. formatColor units for #e84739')

const SAMPLE = '#e84739'
const sampleRgb = hexToRgb(SAMPLE)
const units = ['hex', 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'oklch', 'oklab']
const emitted = Object.fromEntries(units.map((unit) => [unit, formatColor(SAMPLE, unit)]))
for (const unit of units) console.log(`  ${unit.padEnd(6)} ${emitted[unit]}`)

const numbersIn = (text) => (text.match(/-?\d*\.?\d+/g) || []).map(Number)

function hslToRgb(h, s, l) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const sector = ((h % 360) + 360) % 360 / 60
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  const [r, g, b] = sector < 1 ? [chroma, second, 0]
    : sector < 2 ? [second, chroma, 0]
      : sector < 3 ? [0, chroma, second]
        : sector < 4 ? [0, second, chroma]
          : sector < 5 ? [second, 0, chroma]
            : [chroma, 0, second]
  const match = l - chroma / 2
  return { r: (r + match) * 255, g: (g + match) * 255, b: (b + match) * 255 }
}

function hwbToRgb(h, w, blackness) {
  const pure = hslToRgb(h, 1, 0.5)
  const scale = 1 - w - blackness
  return {
    r: (pure.r / 255) * scale * 255 + w * 255,
    g: (pure.g / 255) * scale * 255 + w * 255,
    b: (pure.b / 255) * scale * 255 + w * 255,
  }
}

const worst = (rgb) => Math.max(Math.abs(rgb.r - sampleRgb.r), Math.abs(rgb.g - sampleRgb.g), Math.abs(rgb.b - sampleRgb.b))

const rgbBack = numbersIn(emitted.rgb)
const rgbaBack = numbersIn(emitted.rgba)
const [hslHue, hslSat, hslLight] = numbersIn(emitted.hsl)
const [hwbHue, hwbWhite, hwbBlack] = numbersIn(emitted.hwb)
const oklchBack = numbersIn(emitted.oklch)
const oklabBack = numbersIn(emitted.oklab)

const rgbError = worst({ r: rgbBack[0], g: rgbBack[1], b: rgbBack[2] })
const hslError = worst(hslToRgb(hslHue, hslSat / 100, hslLight / 100))
const hwbError = worst(hwbToRgb(hwbHue, hwbWhite / 100, hwbBlack / 100))
const oklchError = worst(hexToRgb(formatColor({ L: oklchBack[0], C: oklchBack[1], H: oklchBack[2] }, 'hex')))

console.log(`  round-trip error (0-255)  rgb ${round(rgbError, 2)}  hsl ${round(hslError, 2)}  hwb ${round(hwbError, 2)}  oklch ${round(oklchError, 2)}`)

check('hex is lowercase and canonical', emitted.hex === SAMPLE)
check('every unit emits a non-empty string', units.every((unit) => emitted[unit].length > 0))
check('rgb round-trips within 1/255', rgbError <= 1)
check('rgba matches rgb plus an opaque alpha', rgbaBack.slice(0, 3).join() === rgbBack.join() && rgbaBack[3] === 1)
check('hsla matches hsl plus an opaque alpha', emitted.hsla === emitted.hsl.replace('hsl(', 'hsla(').replace(')', ', 1)'))
// hsl/hwb are emitted with whole-number percents per the plan, which is a
// 0.5% quantisation on two axes; 3/255 is that rounding budget, not slack.
check('hsl round-trips within its whole-percent rounding budget', hslError <= 3, `${round(hslError, 2)}/255`)
check('hwb round-trips within its whole-percent rounding budget', hwbError <= 3, `${round(hwbError, 2)}/255`)
check('oklch round-trips within 1/255', oklchError <= 1)
check('oklab keeps 3 decimals', oklabBack.length === 3 && emitted.oklab.startsWith('oklab('))
check('formatColor reads OKLCH directly, not the hex', formatColor(hexToOklch(SAMPLE), 'oklch') === emitted.oklch)

const formattedPalette = buildPalette({ colorFormat: 'oklch' })
check('colorFormat drives the model values', formattedPalette.colors[0].value.startsWith('oklch('))

check('readable ink flips with background', readableTextOn('#ffffff') === '#111111' && readableTextOn('#111111') === '#ffffff')
check('contrast ratio of white on black is 21', Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 0.01)

// 7. Tokens and names --------------------------------------------------------
section('7. Tokens and names')

const TAILWIND = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const tokenLadder = [50, 40, 30, 20, 10, 0, -10, -20, -30, -40, -50].map((pct) => tokenScale(pct, 50))
console.log(`  +/-50% in 10% steps  ${tokenLadder.join(' ')}`)
check('default ladder is the 50-950 scale', tokenLadder.join() === TAILWIND.join())

const scaleTokens = buildPalette({ stepPercent: 10, stepCount: 5 }).colors[0].steps.map((step) => step.token)
console.log(`  step tokens          ${scaleTokens.join(' ')}`)
check('step tokens carry the color name', scaleTokens[0].startsWith('red-') && scaleTokens.includes('red-500'))

const percentTokens = buildPalette({ stepNaming: 'percent', stepPercent: 10, stepCount: 2 }).colors[0].steps.map((step) => step.token)
console.log(`  percent tokens       ${percentTokens.join(' ')}`)
check('percent naming reads l20/base/d20', percentTokens.join() === 'red-l20,red-l10,red,red-d10,red-d20')

const indexNames = buildPalette({ nameStyle: 'index', namePrefix: 'Brand Color!' }).colors.map((color) => color.name)
console.log(`  index names          ${indexNames.slice(0, 3).join(' ')} ...`)
check('index naming sanitizes the prefix', indexNames[0] === 'brand-color-1')

const duplicateNames = buildPalette({ paletteSource: 'custom', customColors: ['#e84739', '#e8473a', '#c9c9c9', '#cacaca'] }).colors.map((color) => color.name)
console.log(`  dedupe               ${duplicateNames.join(' ')}`)
check('duplicate names get -2 suffixes', duplicateNames.join() === 'red,red-2,gray,gray-2')

// 8. Determinism -------------------------------------------------------------
section('8. Determinism')

function walkLibFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walkLibFiles(path) : path.endsWith('.js') ? [path] : []
  })
}

const nondeterministic = walkLibFiles(LIB_DIR)
  .filter((path) => /Math\.random|Date\.now|new Date\(/.test(readFileSync(path, 'utf8')))
  .map((path) => relative(LIB_DIR, path))
check('no clock or randomness in src/lib', nondeterministic.length === 0, nondeterministic.join(' '))

const repeated = buildPalette({ count: 9, unify: 40, temperature: -30 })
const repeatedAgain = buildPalette({ count: 9, unify: 40, temperature: -30 })
check('same settings produce the same palette', JSON.stringify(repeated) === JSON.stringify(repeatedAgain))

// 9. Fork stability ----------------------------------------------------------
section('9. Forking a generated palette under live adjustments')

// The fork bug: customColors used to be written from the DISPLAYED hexes, which
// have already been through harmonize, so buildPalette applied every adjustment
// a second time and the whole palette jumped one hueShift further the moment
// anyone clicked Custom, sorted, reversed or edited a swatch. sourceHex is the
// value underneath the adjustments, and forking on it has to be a no-op.
const ADJUSTED = { hueShift: 40, satScale: 130 }
const generated = buildPalette(ADJUSTED)
const sourceHexes = generated.colors.map((color) => color.sourceHex)
const forked = buildPalette({ ...ADJUSTED, paletteSource: 'custom', customColors: sourceHexes })

const doubled = buildPalette({
  ...ADJUSTED,
  paletteSource: 'custom',
  customColors: generated.colors.map((color) => color.hex),
})

// A palette is stored as hex, so a fork costs one 8-bit round trip and nothing
// more. What matters is the difference between that and the bug: the hue of a
// forked color has to stay where it was, not travel another hueShift.
const forkChannelDrift = Math.max(...generated.colors.map((color, index) => channelDelta(color.hex, forked.colors[index].hex)))
const forkHueDrift = Math.max(...generated.colors.map((color, index) => (
  Math.abs(hueDelta(hexToOklch(color.hex).H, hexToOklch(forked.colors[index].hex).H))
)))
const doubledHueDrift = Math.max(...generated.colors.map((color, index) => (
  Math.abs(hueDelta(hexToOklch(color.hex).H, hexToOklch(doubled.colors[index].hex).H))
)))

console.log(`  generated  ${generated.colors.map((color) => color.hex).join(' ')}`)
console.log(`  sourceHex  ${sourceHexes.join(' ')}`)
console.log(`  forked     ${forked.colors.map((color) => color.hex).join(' ')}`)
console.log(`  bug repro  ${doubled.colors.map((color) => color.hex).join(' ')}   (forking on the displayed hex)`)
console.log(`  fork drift ${forkChannelDrift}/255, ${round(forkHueDrift, 2)}deg   vs the bug's ${round(doubledHueDrift, 1)}deg`)

check('every color carries a pre-adjustment sourceHex', generated.colors.every((color) => HEX_PATTERN.test(color.sourceHex)))
check(
  'sourceHex is the value before the adjustments, not after',
  generated.colors.some((color) => color.sourceHex !== color.hex),
)
check(
  'forking with no adjustments running is byte-identical',
  buildPalette({ paletteSource: 'custom', customColors: defaultPalette.colors.map((color) => color.sourceHex) })
    .colors.map((color) => color.hex).join() === defaultHexes.join(),
)
check(
  'forking under live adjustments holds every hue where it was',
  forked.source === 'custom' && forkHueDrift < 1,
  `${round(forkHueDrift, 2)}deg`,
)
check(
  'forking costs at most the 8-bit round trip of storing a hex',
  forkChannelDrift <= 3,
  `${forkChannelDrift}/255`,
)
check(
  'forking again on the forked palette changes nothing at all',
  buildPalette({ ...ADJUSTED, paletteSource: 'custom', customColors: forked.colors.map((color) => color.sourceHex) })
    .colors.map((color) => color.hex).join() === forked.colors.map((color) => color.hex).join(),
)
check(
  'the old fork-on-displayed-hex path moved every hue by the shift',
  doubledHueDrift > 30,
  `${round(doubledHueDrift, 1)}deg`,
)

const EDIT_INDEX = 2
const editedSources = sourceHexes.map((hex, index) => (index === EDIT_INDEX ? '#123456' : hex))
const edited = buildPalette({ ...ADJUSTED, paletteSource: 'custom', customColors: editedSources })
const movedColumns = edited.colors
  .map((color, index) => (color.hex === forked.colors[index].hex ? null : index))
  .filter((index) => index !== null)
check(
  'editing one sourceHex moves exactly one column',
  movedColumns.join() === String(EDIT_INDEX),
  `moved ${movedColumns.join(' ') || 'none'}`,
)

// Reversing runs on a palette that is already custom, so it is exact: the drift
// belongs to the fork alone and must never accumulate one operation at a time.
const reversedTwice = buildPalette({
  ...ADJUSTED,
  paletteSource: 'custom',
  customColors: reverseColors(reverseColors(forked.colors.map((color) => color.sourceHex))),
})
check(
  'reverse twice returns the exact original hexes',
  reversedTwice.colors.map((color) => color.hex).join() === forked.colors.map((color) => color.hex).join(),
)

// 10. Reshaping operations ---------------------------------------------------
section('10. Distribute evenly ignores neutral hue noise')

// #c9c9c9 and #c9c9ca are the same gray to the eye and 100+ degrees apart to
// atan2, so a neutral anywhere in the palette used to set the stride for every
// chromatic swatch in it.
const NEUTRAL_A = ['#ff0000', '#c9c9c9', '#00c8ff', '#7a00e6']
const NEUTRAL_B = ['#ff0000', '#c9c9ca', '#00c8ff', '#7a00e6']
const spacedA = distributeEvenly(NEUTRAL_A)
const spacedB = distributeEvenly(NEUTRAL_B)
const chromaticPositions = [0, 2, 3]

console.log(`  #c9c9c9 in  ${spacedA.join(' ')}`)
console.log(`  #c9c9ca in  ${spacedB.join(' ')}`)

check(
  'a one-digit change to a neutral leaves every chromatic result identical',
  chromaticPositions.every((index) => spacedA[index] === spacedB[index]),
)
check(
  'the neutral keeps its own hex and its own position',
  spacedA[1] === '#c9c9c9' && spacedB[1] === '#c9c9ca',
)
check(
  'the chromatic endpoints stay put and the middle moves onto the path',
  spacedA[0] === NEUTRAL_A[0] && spacedA[3] === NEUTRAL_A[3],
)

// 11. Naming and parsing guards ----------------------------------------------
section('11. Identifier and paste guards')

console.log(`  sanitizeLabel  2024 -> ${sanitizeLabel('2024')}   2024 Brand -> ${sanitizeLabel('2024 Brand')}`)

check('a digit-leading label gains a letter for SCSS and LESS', sanitizeLabel('2024') === 'c2024')
check('the lead-in survives punctuation stripping', sanitizeLabel('2024 Brand!') === 'c2024-brand')
check('an ordinary label is untouched', sanitizeLabel('Brand Color') === 'brand-color' && sanitizeLabel('') === '')
check(
  'a digit-leading prefix reaches the palette tokens',
  buildPalette({ nameStyle: 'index', namePrefix: '2024' }).colors[0].token === 'c2024-1',
)

const WORDS = 'cafe decade beef added'
const wordParse = parseColorList(WORDS)
const hashedParse = parseColorList('#cafe #ffaacc ffaa00 ffaa0080')

console.log(`  bare words     ${WORDS} -> ${wordParse.colors.length} colors`)
console.log(`  with the hash  ${hashedParse.colors.join(' ')}`)

check('English words spelled in hex are not colors', wordParse.colors.length === 0 && wordParse.rejected.length === 4)
check('the hash still buys every CSS hex form', normalizeHex('#cafe') !== null && normalizeHex('#ffaacc') === '#ffaacc' && normalizeHex('#f00') === '#ff0000')
check('a bare code with digits is still read', normalizeHex('ffaa00') === '#ffaa00' && normalizeHex('ffaa0080') === '#ffaa00')
check('a bare all-letter code is rejected', normalizeHex('ffeeaa') === null && normalizeHex('beef') === null)
check('a bare code that is too short is rejected', normalizeHex('f00') === null && normalizeHex('ff0') === null)
check('parse keeps the four hashed and digit-bearing codes', hashedParse.colors.length === 4)

// 12. Harmony modes ----------------------------------------------------------
section('12. Harmony modes')

// The spectrum output for the default settings, pinned to the byte. Harmony was
// added underneath this row, and the whole point of the spectrum branch is that
// it did not move: any drift here is a regression, not a new look.
const SPECTRUM_BASELINE = ['#ec5c4d', '#e7aa4b', '#bde158', '#5de3b9', '#54cae6', '#4276e6', '#b25ce9']
const harmonyNames = ['spectrum', ...SWEEP_HARMONIES.slice(1), ...Object.keys(HARMONY_OFFSETS)]
const bareRowFor = (settings) => buildPalette({ stepCount: 0, ...settings }).colors

for (const harmony of harmonyNames) {
  const row = bareRowFor({ harmony })
  console.log(`  ${harmony.padEnd(14)} ${row.map((color) => color.hex).join(' ')}`)
}

check(
  'spectrum is byte-identical to the pinned default row',
  defaultHexes.join() === SPECTRUM_BASELINE.join(),
  defaultHexes.join(' '),
)
check(
  'the app lands on the true rainbow',
  PARAM_BY_KEY.harmony.default === 'spectral'
    && bareRowFor({}).map((color) => color.hex).join() === bareRowFor({ harmony: 'spectral' }).map((color) => color.hex).join(),
  PARAM_BY_KEY.harmony.default,
)
check(
  'the engine fallback and the registry default agree',
  DEFAULT_PALETTE_SETTINGS.harmony === PARAM_BY_KEY.harmony.default,
  `${DEFAULT_PALETTE_SETTINGS.harmony} / ${PARAM_BY_KEY.harmony.default}`,
)
check(
  'landing on the page names the seven spectral colors',
  bareRowFor({}).map((color) => color.name).join(' ') === 'red orange yellow green blue indigo violet',
)
check(
  'every registry harmony option is a mode the engine knows',
  PARAM_BY_KEY.harmony.options.every((option) => (
    PATH_HARMONIES.includes(option.value) || Boolean(HARMONY_OFFSETS[option.value])
  )),
  PARAM_BY_KEY.harmony.options.map((option) => option.value).join(' '),
)

// Anchors --------------------------------------------------------------------
const ANCHOR_START_HUES = [29, 200, 341]

for (const [harmony, offsets] of Object.entries(HARMONY_OFFSETS)) {
  const worstDrift = ANCHOR_START_HUES.reduce((widest, startHue) => {
    const row = bareRowFor({ harmony, startHue, count: 9 })
    return row.reduce((worst, color, index) => {
      const wanted = normalizeHue(startHue + offsets[index % offsets.length])
      return Math.max(worst, Math.abs(hueDelta(color.base.H, wanted)))
    }, widest)
  }, 0)
  check(
    `${harmony} lands every color on ${offsets.join('/')} deg from the start hue`,
    worstDrift < 1,
    `max drift ${round(worstDrift, 4)}deg`,
  )
}

const DISTRIBUTIONS = { complementary: '4,3', split: '3,2,2', triad: '3,2,2', tetrad: '2,2,2,1' }
for (const [harmony, expected] of Object.entries(DISTRIBUTIONS)) {
  const offsets = HARMONY_OFFSETS[harmony]
  const row = bareRowFor({ harmony, count: 7 })
  const perAnchor = offsets.map((offset) => {
    const wanted = normalizeHue(29 + offset)
    return row.filter((color) => Math.abs(hueDelta(color.base.H, wanted)) < 1).length
  })
  check(
    `${harmony} spreads 7 colors over ${offsets.length} anchors as ${expected}`,
    perAnchor.join() === expected,
    perAnchor.join('-'),
  )
}

const alternating = bareRowFor({ harmony: 'triad', count: 7 })
check(
  'round-robin keeps neighbouring colors off the same anchor',
  alternating.every((color, index) => index === 0 || Math.abs(hueDelta(color.base.H, alternating[index - 1].base.H)) > 1),
)

const anchorIgnoringSweep = bareRowFor({ harmony: 'triad', hueSpread: 60, direction: 'ccw', hueEasing: 'easeIn' })
check(
  'spread, direction and easing do not reach the anchor modes',
  anchorIgnoringSweep.map((color) => color.hex).join() === bareRowFor({ harmony: 'triad' }).map((color) => color.hex).join(),
)

// Repeats --------------------------------------------------------------------
const repeated7 = bareRowFor({ harmony: 'complementary', count: 7 })
const firstAnchorRepeats = repeated7.filter((color, index) => index % 2 === 0)
console.log(`  repeats on one anchor  ${firstAnchorRepeats.map((color) => `${color.hex} L=${round(color.base.L, 3)} C=${round(color.base.C, 3)}`).join('   ')}`)

check(
  'repeats on one anchor stay on its hue',
  hueSpread(firstAnchorRepeats.map((color) => color.base.H)) < 1,
)
// Measured against each stop's own gamut headroom, because the headroom itself
// moves with lightness: a darker repeat can carry more chroma than a lighter one
// while still being the more tapered of the two.
const repeatSaturation = firstAnchorRepeats.map((color) => color.base.C / maxChroma(color.base.L, color.base.H))
check(
  'chroma tapers monotonically pass by pass',
  repeatSaturation.every((value, index) => index === 0 || value <= repeatSaturation[index - 1] + 1e-9),
  repeatSaturation.map((value) => round(value, 3)).join(' > '),
)
check(
  'the first pass on an anchor keeps the mode lightness',
  Math.abs(repeated7[0].base.L - bareRowFor({ harmony: 'monochrome', count: 1 })[0].base.L) < 1e-9,
)

// Monochrome -----------------------------------------------------------------
for (const count of [7, 12, 24]) {
  const mono = bareRowFor({ harmony: 'monochrome', count })
  const hexes = mono.map((color) => color.hex)
  const ladders = buildPalette({ harmony: 'monochrome', count, stepCount: 5 }).colors
  check(
    `monochrome x${count} is one hue in ${count} distinct stops`,
    hueSpread(mono.map((color) => color.base.H)) < 1
      && new Set(hexes).size === count
      && new Set(ladders.map((color) => color.hex)).size === count,
    `hue spread ${round(hueSpread(mono.map((color) => color.base.H)), 3)}deg, ${new Set(hexes).size} distinct`,
  )
}

const monoRow = bareRowFor({ harmony: 'monochrome', count: 7 })
const monoLightnesses = monoRow.map((color) => color.base.L)
console.log(`  monochrome x7  ${monoRow.map((color) => color.hex).join(' ')}`)
console.log(`  L              ${monoLightnesses.map((L) => round(L, 3).toFixed(3)).join(' ')}`)
check(
  'monochrome steps through lightness rather than repeating one tint ladder',
  spread(monoLightnesses) > 0.25,
  `L spread ${round(spread(monoLightnesses), 3)}`,
)

// Analogous ------------------------------------------------------------------
const analogousWidest = [30, 90, 200, 281, 360].reduce((widest, requested) => {
  const row = bareRowFor({ harmony: 'analogous', hueSpread: requested, count: 12 })
  return Math.max(widest, hueSpread(row.map((color) => color.base.H)))
}, 0)
const analogousUnderCap = bareRowFor({ harmony: 'analogous', hueSpread: 60 })
console.log(`  analogous widest span  ${round(analogousWidest, 2)}deg  (cap ${ANALOGOUS_MAX_SPREAD})`)

check(
  'analogous never spans more than 90deg',
  analogousWidest <= ANALOGOUS_MAX_SPREAD + 1e-9,
  `${round(analogousWidest, 2)}deg`,
)
check(
  'analogous respects a spread under the cap',
  Math.abs(hueSpread(analogousUnderCap.map((color) => color.base.H)) - 60) < 0.01,
)
check(
  'analogous still reads direction and easing',
  bareRowFor({ harmony: 'analogous', direction: 'ccw' }).map((color) => color.hex).join()
    !== analogousUnderCap.map((color) => color.hex).join(),
)

// Every mode through the whole pipeline ---------------------------------------
const harmonyFailures = []
for (const harmony of harmonyNames) {
  for (const count of [1, 2, 7, 24]) {
    for (const lightnessMode of ['natural', 'flat']) {
      for (const lightness of [5, 72, 95]) {
        const built = buildPalette({ harmony, count, lightnessMode, lightness })
        const valid = built.colors.length === count
          && built.colors.every((color) => (
            HEX_PATTERN.test(color.hex)
            && isInGamut(color.base)
            && color.steps.every((step) => HEX_PATTERN.test(step.hex))
          ))
        if (!valid) harmonyFailures.push(`${harmony}/${count}/${lightnessMode}/${lightness}`)
      }
    }
  }
}
check('every mode stays in gamut at every count and lightness', harmonyFailures.length === 0, harmonyFailures.join(' '))

const nondeterministicModes = harmonyNames.filter((harmony) => {
  const settings = { harmony, count: 9, startHue: 137, unify: 20, contrast: 15 }
  return JSON.stringify(buildPalette(settings)) !== JSON.stringify(buildPalette(settings))
})
check('every mode is deterministic across runs', nondeterministicModes.length === 0, nondeterministicModes.join(' '))

// Registry and presets -------------------------------------------------------
const SWEEP_ONLY_KEYS = ['hueSpread', 'direction', 'hueEasing']
const anchorHarmonies = Object.keys(HARMONY_OFFSETS)
const generatorParams = PARAM_REGISTRY.filter((param) => param.group === 'Generator')

check(
  'harmony sits first in the Generator group, above count',
  generatorParams[0].key === 'harmony' && generatorParams[1].key === 'count',
  generatorParams.slice(0, 2).map((param) => param.key).join(' '),
)
const rolls = PARAM_BY_KEY.harmony.randomValues
const rollsFor = (harmony) => rolls.filter((value) => value === harmony).length
check(
  'randomize is weighted toward the rainbows',
  PARAM_BY_KEY.harmony.randomize === true
    && rolls.filter((value) => PATH_HARMONIES.includes(value)).length > rolls.length / 2
    && PATH_HARMONIES.every((path) => anchorHarmonies.every((anchor) => rollsFor(path) > rollsFor(anchor)))
    && anchorHarmonies.every((anchor) => rollsFor(anchor) > 0),
  rolls.join(' '),
)
check(
  'the arc controls hide on the anchor modes and show on the sweeps',
  SWEEP_ONLY_KEYS.every((key) => (
    SWEEP_HARMONIES.every((harmony) => PARAM_BY_KEY[key].showIf({ harmony }))
    && anchorHarmonies.every((harmony) => !PARAM_BY_KEY[key].showIf({ harmony }))
  )),
)
check(
  'the arc controls hide rather than grey out (disabledIf is the custom-palette pause)',
  SWEEP_ONLY_KEYS.every((key) => !PARAM_BY_KEY[key].disabledIf({ harmony: 'triad', paletteSource: 'generated' })),
)

const presetProblems = []
for (const preset of PRESETS) {
  for (const [key, value] of Object.entries(preset.settings)) {
    const param = PARAM_BY_KEY[key]
    if (!param) {
      presetProblems.push(`${preset.id}.${key} is not in the registry`)
      continue
    }
    if (JSON.stringify(coerceParamValue(param, value)) !== JSON.stringify(value)) {
      presetProblems.push(`${preset.id}.${key}=${value} is not a legal value`)
    }
  }
  if (!('harmony' in preset.settings)) presetProblems.push(`${preset.id} does not state its harmony`)
}
const presetHarmonies = PRESETS.map((preset) => preset.settings.harmony)
console.log(`  presets  ${PRESETS.length}: ${PRESETS.map((preset) => preset.label).join(', ')}`)

check('every preset validates against the registry', presetProblems.length === 0, presetProblems.join('; '))
check(
  'every preset spells out its harmony',
  presetHarmonies.every(Boolean),
  presetHarmonies.join(' '),
)
check(
  'the true-rainbow presets are the ones intended',
  PRESETS.filter((preset) => preset.settings.harmony === 'spectral').map((preset) => preset.id).join() === 'roygbiv,neon',
  presetHarmonies.join(' '),
)
check(
  'the presets cover every harmony the engine offers',
  PARAM_BY_KEY.harmony.options.every((option) => presetHarmonies.includes(option.value)),
  [...new Set(presetHarmonies)].join(' '),
)
check(
  'the pages divide evenly, so no page turn lands on a stray row',
  PRESETS.length % PRESETS_PER_PAGE === 0,
  `${PRESETS.length} presets, ${PRESETS.length / PRESETS_PER_PAGE} pages of ${PRESETS_PER_PAGE}`,
)

// A preset earns its slot by not being another preset. This is the check that
// keeps the list honest as it grows: the floor is set by ROYGBIV against Neon,
// which share their hues on purpose, so anything closer than that is a twin.
const PRESET_DISTANCE_FLOOR = 0.05
const presetPalettes = PRESETS.map((preset) => ({
  label: preset.label,
  colors: bareRowFor(preset.settings).map((color) => color.base),
}))
const toOklab = ({ L, C, H }) => {
  const radians = (H * Math.PI) / 180
  return [L, C * Math.cos(radians), C * Math.sin(radians)]
}
const paletteDistance = (a, b) => {
  const shared = Math.min(a.length, b.length)
  let total = 0
  for (let index = 0; index < shared; index++) {
    const [l1, a1, b1] = toOklab(a[index])
    const [l2, a2, b2] = toOklab(b[index])
    total += Math.hypot(l1 - l2, a1 - a2, b1 - b2)
  }
  return total / shared
}
let closestPair = { label: '', distance: Infinity }
for (let i = 0; i < presetPalettes.length; i++) {
  for (let j = i + 1; j < presetPalettes.length; j++) {
    const distance = paletteDistance(presetPalettes[i].colors, presetPalettes[j].colors)
    if (distance < closestPair.distance) {
      closestPair = { label: `${presetPalettes[i].label} / ${presetPalettes[j].label}`, distance }
    }
  }
}
check(
  'no two presets are near-duplicates of each other',
  closestPair.distance >= PRESET_DISTANCE_FLOOR,
  `closest is ${closestPair.label} at ${closestPair.distance.toFixed(3)}`,
)
check(
  'every preset builds a usable palette',
  PRESETS.every((preset) => {
    const built = buildPalette(preset.settings)
    return built.colors.length > 0 && built.colors.every((color) => HEX_PATTERN.test(color.hex))
  }),
)

// 13. True rainbow (spectral) ------------------------------------------------
section('13. True rainbow lands on the named hues')

// The whole point of the mode: an even sweep steps over yellow, this does not.
const CANARY_HUE = hexToOklch('#ffff00').H
const spectralRow = bareRowFor({ harmony: 'spectral' })
const spectralHues = spectralRow.map((color) => color.base.H)
const spectralNames = spectralRow.map((color) => color.name)
console.log(`  hues   ${spectralHues.map((hue) => hue.toFixed(0)).join(', ')}`)
console.log(`  names  ${spectralNames.join(' ')}`)
console.log(`  hexes  ${spectralRow.map((color) => color.hex).join(' ')}`)

check(
  'seven colors land exactly on the named offsets',
  spectralHues.every((hue, index) => Math.abs(hue - (DEFAULT_START_HUE + SPECTRAL_HUE_OFFSETS[index])) < 0.01),
  spectralHues.map((hue) => hue.toFixed(1)).join(' '),
)
check(
  'the yellow slot really is yellow, within a degree of #ffff00',
  Math.abs(spectralHues[2] - CANARY_HUE) <= 1,
  `${spectralHues[2].toFixed(1)} vs ${CANARY_HUE.toFixed(1)}`,
)
// The even sweep straddles yellow: its nearest stop sits ~13deg away, on lime.
const sweepMissesYellowBy = Math.min(
  ...bareRowFor({ harmony: 'spectrum' }).map((color) => Math.abs(color.base.H - CANARY_HUE)),
)
check(
  'the even sweep leaves a visible gap at yellow that the named path closes',
  sweepMissesYellowBy > 10 && Math.abs(spectralHues[2] - CANARY_HUE) < sweepMissesYellowBy / 10,
  `sweep off by ${sweepMissesYellowBy.toFixed(1)}deg, named off by ${Math.abs(spectralHues[2] - CANARY_HUE).toFixed(1)}deg`,
)
check(
  'the seven names read as the spectrum',
  spectralNames.join(' ') === 'red orange yellow green blue indigo violet',
  spectralNames.join(' '),
)
check(
  'the ROYGBIV preset is the one that produces those names',
  bareRowFor(PRESETS.find((preset) => preset.id === 'roygbiv').settings)
    .map((color) => color.name).join(' ') === 'red orange yellow green blue indigo violet',
)
check(
  'the Spectrum preset keeps the even sweep it inherited',
  PRESETS.find((preset) => preset.id === 'spectrum').settings.harmony === 'spectrum',
)

// Other counts walk the same path rather than drifting off it.
for (const count of [2, 3, 5, 12, 24]) {
  const hues = bareRowFor({ harmony: 'spectral', count }).map((color) => color.base.H)
  const spans = hues.every((hue, index) => index === 0 || hue > hues[index - 1])
  check(
    `count ${count} interpolates along the path without doubling back`,
    spans
      && Math.abs(hues[0] - DEFAULT_START_HUE) < 0.01
      && Math.abs(hues[hues.length - 1] - (DEFAULT_START_HUE + SPECTRAL_HUE_OFFSETS[SPECTRAL_HUE_OFFSETS.length - 1])) < 0.01,
    hues.map((hue) => hue.toFixed(0)).join(' '),
  )
}

check(
  'start hue rotates the whole path, keeping the spacing',
  bareRowFor({ harmony: 'spectral', startHue: 100 }).map((color) => color.base.H)
    .every((hue, index) => Math.abs(normalizeHue(hue) - normalizeHue(100 + SPECTRAL_HUE_OFFSETS[index])) < 0.01),
)
check(
  'counter-clockwise mirrors the path',
  bareRowFor({ harmony: 'spectral', direction: 'ccw' }).map((color) => color.base.H)
    .every((hue, index) => Math.abs(normalizeHue(hue) - normalizeHue(DEFAULT_START_HUE - SPECTRAL_HUE_OFFSETS[index])) < 0.01),
)

// ---------------------------------------------------------------------------
console.log(`\n${failures ? 'FAILED' : 'OK'}  ${checks - failures}/${checks} checks passed`)
process.exit(failures ? 1 : 0)
