// Export fixture: builds a real palette and asserts every export format the
// plan promises, including the color-unit round trips. No dependencies, no
// browser, no dev server.
//   node scripts/verify-exports.mjs

import { COLOR_UNITS, formatColor } from '../src/lib/color/format.js'
import { hexToRgb } from '../src/lib/color/oklch.js'
import { normalizeHex } from '../src/lib/color/parse.js'
import { getDefaults } from '../src/data/params.js'
import { buildPalette } from '../src/lib/palette.js'
import {
  EXPORT_FORMATS,
  EXPORT_GROUPS,
  QUALITY_RANGE,
  RASTER_DEFAULTS,
  clampQuality,
  exportFormatById,
  exportFormatsInGroup,
  mergeFormatOptions,
} from '../src/lib/export/index.js'
import { buildCss, buildLess, buildScss } from '../src/lib/export/code.js'
import { buildTailwind, tailwindColors } from '../src/lib/export/tailwind.js'
import { buildTokens } from '../src/lib/export/tokens.js'
import { buildSvg, sheetLayout } from '../src/lib/export/svg.js'
import { normalizeScale, rasterSize } from '../src/lib/export/raster.js'
import { exportFilename, exportTimestamp } from '../src/lib/export/download.js'

const EXPECTED_FORMAT_IDS = ['css', 'scss', 'less', 'tailwind', 'json', 'svg', 'png', 'jpg', 'webp']
const CSS_DECLARATION = /^ {2}--([a-z0-9-]+): (.+);$/
const BASE_ALIAS = /^color-\d+$/

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

function round(value, places = 2) {
  return Number(value.toFixed(places))
}

function cssDeclarations(css) {
  return css
    .split('\n')
    .map((line) => CSS_DECLARATION.exec(line))
    .filter(Boolean)
    .map((match) => ({ token: match[1], value: match[2] }))
}

function paletteFor(overrides = {}) {
  return buildPalette({ ...getDefaults(), ...overrides })
}

const defaults = getDefaults()
const palette = paletteFor()
const colorCount = palette.meta.count
const stepsPerColor = 2 * palette.meta.stepCount + 1
const everyStep = palette.colors.flatMap((color) => color.steps)

console.log(`  palette   ${colorCount} colors x ${stepsPerColor} steps  (${palette.colors.map((color) => color.name).join(' ')})`)

// 1. Registry ----------------------------------------------------------------
section('1. Format registry')

check('nine formats', EXPORT_FORMATS.length === 9, `${EXPORT_FORMATS.length}`)
check(
  'ids match the plan',
  EXPORT_FORMATS.map((format) => format.id).join() === EXPECTED_FORMAT_IDS.join(),
  EXPORT_FORMATS.map((format) => format.id).join(' '),
)
check(
  'every entry carries label, ext, mime, kind and group',
  EXPORT_FORMATS.every((format) => format.label && format.ext && format.mime
    && ['text', 'raster'].includes(format.kind)
    && EXPORT_GROUPS.some((group) => group.id === format.group)),
)
check(
  'kind decides build or render, never both',
  EXPORT_FORMATS.every((format) => (
    format.kind === 'text'
      ? typeof format.build === 'function' && !format.render
      : typeof format.render === 'function' && !format.build
  )),
)
check(
  'groups partition the registry',
  exportFormatsInGroup('code').length + exportFormatsInGroup('image').length === EXPORT_FORMATS.length,
  `code ${exportFormatsInGroup('code').length}, image ${exportFormatsInGroup('image').length}`,
)
check('unknown id falls back to the first format', exportFormatById('nope').id === 'css')
check(
  'only jpg and webp offer a quality dial',
  EXPORT_FORMATS.filter((format) => format.supportsQuality).map((format) => format.id).join() === 'jpg,webp',
)
check('jpg declares itself opaque', exportFormatById('jpg').opaque === true)

// 2. CSS ---------------------------------------------------------------------
section('2. CSS')

const css = buildCss(palette)
const declarations = cssDeclarations(css)
const aliases = declarations.filter((entry) => BASE_ALIAS.test(entry.token))
const scales = declarations.filter((entry) => !BASE_ALIAS.test(entry.token))

console.log(`  ${css.split('\n').slice(0, 4).join('\n  ')}`)
console.log(`  ...  ${declarations.length} declarations`)

check('opens a :root block', css.includes(':root {') && css.trimEnd().endsWith('}'))
check(`${colorCount} base aliases`, aliases.length === colorCount, `${aliases.length}`)
check(
  `${colorCount * stepsPerColor} scale variables`,
  scales.length === colorCount * stepsPerColor,
  `${scales.length}`,
)
check(
  'every declaration is valid custom-property syntax',
  declarations.every((entry) => /^[a-z][a-z0-9-]*$/.test(entry.token) && entry.value.length > 0),
)
check('no token is declared twice', new Set(declarations.map((entry) => entry.token)).size === declarations.length)
check(
  'aliases carry the base colors in order',
  aliases.every((entry, index) => entry.value === palette.colors[index].hex),
)
check(
  'scale tokens match the palette model',
  scales.map((entry) => entry.token).join() === everyStep.map((step) => step.token).join(),
)
check('the plan sample line is reproduced', buildCss(paletteFor({ namePrefix: 'rainbow' })).includes(`--rainbow-1: ${palette.colors[0].hex};`))

// Percent naming makes a base step token collide with its own base alias; the
// emitter must drop the duplicate rather than declare the variable twice.
const percentCss = cssDeclarations(buildCss(paletteFor({ stepNaming: 'percent', nameStyle: 'index' })))
check(
  'percent naming produces no duplicate variable',
  new Set(percentCss.map((entry) => entry.token)).size === percentCss.length,
  `${percentCss.length} declarations`,
)

// 3. SCSS and LESS -----------------------------------------------------------
section('3. SCSS and LESS')

const scss = buildScss(palette)
const less = buildLess(palette)
const firstColor = palette.colors[0]
const firstStep = firstColor.steps[0]

check('scss emits flat variables', scss.includes(`$${firstStep.token}: ${firstStep.hex};`), `$${firstStep.token}`)
check('scss emits a map per color', palette.colors.every((color) => scss.includes(`$${color.token}: (`)))
check('scss maps key their steps', scss.includes(`  ${firstStep.token.replace(`${firstColor.token}-`, '')}: ${firstStep.hex}`))
check('scss emits the collection map', scss.includes('$color: (\n  1: '))
check('scss closes every map it opens', (scss.match(/: \(/g) || []).length === (scss.match(/^\);$/gm) || []).length)
check('less emits flat variables', less.includes(`@${firstStep.token}: ${firstStep.hex};`), `@${firstStep.token}`)
check('less emits no maps', !less.includes(': ('))
check(
  'less declares the same tokens as css',
  (less.match(/^@[a-z0-9-]+:/gm) || []).length === declarations.length,
)

// 4. Tailwind ----------------------------------------------------------------
section('4. Tailwind')

const tailwindWrapped = buildTailwind(palette)
const tailwindBare = buildTailwind(palette, { wrapModule: false })

// Running the emitted text through the JavaScript parser is the assertion: a
// Tailwind config that does not evaluate is not a Tailwind config.
function evaluateModule(source) {
  const module = { exports: {} }
  new Function('module', 'exports', source)(module, module.exports)
  return module.exports
}

function evaluateExpression(source) {
  return new Function(`return (${source})`)()
}

let wrappedConfig = null
let bareColors = null
let tailwindParsed = true
try {
  wrappedConfig = evaluateModule(tailwindWrapped)
  bareColors = evaluateExpression(tailwindBare)
} catch (error) {
  tailwindParsed = false
  console.log(`  parse error: ${error.message}`)
}

check('the wrapped config parses as JavaScript', tailwindParsed && wrappedConfig !== null)
check('the bare object parses as JavaScript', tailwindParsed && bareColors !== null)

const tailwindExpected = tailwindColors(palette)
check(
  'wrapped config nests theme.extend.colors',
  JSON.stringify(wrappedConfig?.theme?.extend?.colors) === JSON.stringify(tailwindExpected),
)
check('the toggle strips only the wrapper', JSON.stringify(bareColors) === JSON.stringify(tailwindExpected))
check(
  'every color becomes a shade object',
  palette.colors.every((color) => tailwindExpected[color.token]
    && Object.keys(tailwindExpected[color.token]).length === stepsPerColor),
)
check('scale naming keys the base shade 500', '500' in tailwindExpected[firstColor.token])
check(
  'percent naming keys the base shade DEFAULT',
  'DEFAULT' in tailwindColors(paletteFor({ stepNaming: 'percent' }))[firstColor.token],
)

// 5. JSON tokens -------------------------------------------------------------
section('5. JSON tokens')

let dtcg = null
let flat = null
let jsonParsed = true
try {
  dtcg = JSON.parse(buildTokens(palette))
  flat = JSON.parse(buildTokens(palette, { flat: true }))
} catch (error) {
  jsonParsed = false
  console.log(`  parse error: ${error.message}`)
}

const dtcgLeaves = jsonParsed ? Object.values(dtcg).flatMap((group) => Object.values(group)) : []

check('DTCG output parses', jsonParsed && dtcg !== null)
check('one group per color', Object.keys(dtcg || {}).length === colorCount)
check(`${colorCount * stepsPerColor} leaves`, dtcgLeaves.length === colorCount * stepsPerColor)
check(
  'every leaf carries $type and $value',
  dtcgLeaves.length > 0 && dtcgLeaves.every((leaf) => leaf.$type === 'color' && typeof leaf.$value === 'string' && leaf.$value.length > 0),
)
check('flat output parses', jsonParsed && flat !== null)
check(
  'flat output is one entry per step keyed by token',
  Object.keys(flat || {}).length === colorCount * stepsPerColor
  && Object.keys(flat || {}).join() === everyStep.map((step) => step.token).join(),
)
check('flat values match the model', everyStep.every((step) => flat[step.token] === step.hex))

// 6. SVG ---------------------------------------------------------------------
section('6. SVG swatch sheet')

const svg = buildSvg(palette, { background: 'white' })
const layout = sheetLayout(palette, { background: 'white' })

function tagBalance(markup) {
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/g
  const stack = []
  let match = tagPattern.exec(markup)
  while (match) {
    const [tag, name, selfClosing] = match
    if (selfClosing) {
      // self-closing, nothing to track
    } else if (tag.startsWith('</')) {
      if (stack.pop() !== name) return { balanced: false, unclosed: name }
    } else {
      stack.push(name)
    }
    match = tagPattern.exec(markup)
  }
  return { balanced: stack.length === 0, unclosed: stack.join(' ') }
}

const balance = tagBalance(svg)
const rectCount = (svg.match(/<rect /g) || []).length
const textCount = (svg.match(/<text /g) || []).length

console.log(`  ${layout.width}x${layout.height}px, ${rectCount} rects, ${textCount} text nodes`)

check('markup is balanced', balance.balanced, balance.unclosed)
check('declares the SVG namespace', svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'))
check(
  'one rect per swatch plus the background',
  rectCount === colorCount * stepsPerColor + 1,
  `${rectCount}`,
)
check(
  'one text node per swatch plus headers and row labels',
  textCount === colorCount * stepsPerColor + stepsPerColor + colorCount,
  `${textCount}`,
)
check('every swatch hex is painted', everyStep.every((step) => svg.includes(`fill="${step.hex}"`)))
check('every swatch value is labelled', everyStep.every((step) => svg.includes(`>${step.value}</text>`)))
check('row labels are the color names', palette.colors.every((color) => svg.includes(`>${color.name}</text>`)))
check('the base column is headed', svg.includes('>Base</text>'))
check('label ink is one of the two contrast inks', (svg.match(/fill="#(111111|ffffff)"/g) || []).length >= colorCount * stepsPerColor)

const rowSheet = buildSvg(palette, { layout: 'row', background: 'black' })
check(
  'row layout keeps the base colors only',
  (rowSheet.match(/<rect /g) || []).length === colorCount + 1,
  `${(rowSheet.match(/<rect /g) || []).length}`,
)
const unlabelled = buildSvg(palette, { showLabels: false })
check('labels off removes every text node', !unlabelled.includes('<text '))
check(
  'labels off shrinks the sheet by the label gutters',
  sheetLayout(palette, { showLabels: false }).width < layout.width,
)
const checkered = buildSvg(palette, { background: 'checker', checkerBase: '#2f2f38', checkerSquare: '#1d1d24' })
check('checker background uses a pattern fill', checkered.includes('<pattern id="sheet-checker"') && checkered.includes('url(#sheet-checker)'))
const titled = buildSvg(palette, { title: 'Sunset & Sea' })
check('a title is escaped and rendered', titled.includes('>Sunset &amp; Sea</text>'))

// 7. Raster layout -----------------------------------------------------------
section('7. Raster layout')

const size1 = rasterSize(palette, { scale: 1 })
const size3 = rasterSize(palette, { scale: 3 })

console.log(`  1x ${size1.width}x${size1.height}   3x ${size3.width}x${size3.height}`)

check('raster imports without a DOM', typeof rasterSize === 'function' && typeof normalizeScale === 'function')
check(
  'raster at 1x matches the SVG sheet exactly',
  size1.width === layout.width && size1.height === layout.height,
  `${size1.width}x${size1.height} vs ${layout.width}x${layout.height}`,
)
check('3x is three times 1x', size3.width === size1.width * 3 && size3.height === size1.height * 3)
check('scale falls back to 1 for junk input', normalizeScale('nope') === 1 && normalizeScale(0) === 1 && normalizeScale(-2) === 1)
check(
  'row layout is one row tall',
  rasterSize(palette, { layout: 'row' }).sheetHeight < rasterSize(palette, { layout: 'grid' }).sheetHeight,
)

// 8. Color units -------------------------------------------------------------
section('8. Every color unit through the CSS build')

function hslToRgb(h, s, l) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const sector = ((((h % 360) + 360) % 360) / 60)
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

const worstChannel = (a, b) => Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b))
const unitReport = []
let allUnitsEmit = true

for (const unit of COLOR_UNITS) {
  const values = cssDeclarations(buildCss(paletteFor({ colorFormat: unit }))).map((entry) => entry.value)
  const sound = values.length === declarations.length
    && values.every((value) => value.length > 0
      && !/NaN|undefined|Infinity/.test(value)
      && (value.match(/\(/g) || []).length === (value.match(/\)/g) || []).length)
  if (!sound) allUnitsEmit = false
  unitReport.push(`${unit}=${values[0]}`)
}

console.log(`  ${unitReport.join('\n  ')}`)
check('all 8 units emit sound values for every declaration', allUnitsEmit)

const reference = palette.colors[0].steps[0]
const referenceRgb = hexToRgb(reference.hex)
const rgbValue = formatColor(reference.oklch, 'rgb')
const rgbaValue = formatColor(reference.oklch, 'rgba')
const hslNumbers = (formatColor(reference.oklch, 'hsl').match(/-?\d*\.?\d+/g) || []).map(Number)

const rgbRoundTrip = worstChannel(hexToRgb(normalizeHex(rgbValue)), referenceRgb)
const rgbaRoundTrip = worstChannel(hexToRgb(normalizeHex(rgbaValue)), referenceRgb)
const hslRoundTrip = worstChannel(hslToRgb(hslNumbers[0], hslNumbers[1] / 100, hslNumbers[2] / 100), referenceRgb)

console.log(`  round trip (0-255)  rgb ${round(rgbRoundTrip)}  rgba ${round(rgbaRoundTrip)}  hsl ${round(hslRoundTrip)}`)

check('rgb() parses back through parse.js within 1/255', rgbRoundTrip <= 1)
check('rgba() parses back through parse.js within 1/255', rgbaRoundTrip <= 1)
check('hsl() round-trips within its whole-percent rounding budget', hslRoundTrip <= 3, `${round(hslRoundTrip)}/255`)
check(
  'the emitted CSS matches what the model already formatted',
  cssDeclarations(buildCss(paletteFor({ colorFormat: 'oklch' })))
    .filter((entry) => !BASE_ALIAS.test(entry.token))
    .every((entry, index) => entry.value === formatColor(everyStep[index].oklch, 'oklch')),
)

// 9. Token dedupe ------------------------------------------------------------
section('9. Token dedupe')

const twins = paletteFor({ paletteSource: 'custom', customColors: ['#e84739', '#e8473a', '#c9c9c9', '#cacaca'] })
const twinCss = cssDeclarations(buildCss(twins))
const twinNames = twins.colors.map((color) => color.name)

console.log(`  names  ${twinNames.join(' ')}`)

check('same-hue colors get suffixed names', twinNames.join() === 'red,red-2,gray,gray-2')
check('no duplicate declaration survives', new Set(twinCss.map((entry) => entry.token)).size === twinCss.length)
check(
  'each name owns its own scale',
  twinNames.every((name) => twinCss.some((entry) => entry.token.startsWith(`${name}-`))),
)
check(
  'the tailwind object keys stay unique',
  Object.keys(tailwindColors(twins)).length === twins.colors.length,
)

// 10. Filenames --------------------------------------------------------------
section('10. Filenames')

const stamped = new Date(2026, 7, 15, 19, 4)
const filename = exportFilename(colorCount, 'css', stamped)
console.log(`  ${filename}`)

check('timestamp is sortable', exportTimestamp(stamped) === '20260815-1904')
check('filename carries the color count and extension', filename === 'palette-7colors-20260815-1904.css')
check(
  'every format produces a distinct extension path',
  EXPORT_FORMATS.every((format) => exportFilename(colorCount, format.ext, stamped).endsWith(`.${format.ext}`)),
)
check('defaults registry still exposes the export params', defaults.colorFormat === 'hex' && defaults.namePrefix === 'color')

// 11. Contested names --------------------------------------------------------
section('11. A contested name never costs a color')

// Percent step naming leaves the base rung of "red-2" named exactly red-2,
// which is also the second base alias when the prefix is "red". The two carry
// DIFFERENT colors here, so dropping the second as a duplicate would delete a
// color from the export outright. It has to be renamed and kept.
const CONTESTED = ['#e84739', '#c9c9c9', '#e8473a']
const contested = paletteFor({
  paletteSource: 'custom',
  customColors: CONTESTED,
  namePrefix: 'red',
  stepNaming: 'percent',
})
const contestedCss = cssDeclarations(buildCss(contested))
const contestedSteps = contested.colors[0].steps.length
const expectedDeclarations = contested.colors.length * (1 + contestedSteps)

console.log(`  names   ${contested.colors.map((color) => color.name).join(' ')}`)
console.log(`  bases   ${contested.colors.map((color) => color.hex).join(' ')}`)
console.log(`  aliases ${contestedCss.filter((entry) => /^red-\d+$/.test(entry.token)).map((entry) => `${entry.token}=${entry.value}`).join(' ')}`)

check(
  'every alias and every step still gets a declaration',
  contestedCss.length === expectedDeclarations,
  `${contestedCss.length} of ${expectedDeclarations}`,
)
check('no token is declared twice', new Set(contestedCss.map((entry) => entry.token)).size === contestedCss.length)
check(
  'every color base rung survives the collision',
  contested.colors.every((color) => contestedCss.some((entry) => entry.value === color.hex)),
)
check(
  'the contested name is kept under the next free suffix, not dropped',
  contestedCss.some((entry) => entry.token === 'red-2' && entry.value === contested.colors[1].hex)
  && contestedCss.some((entry) => entry.token === 'red-2-2' && entry.value === contested.colors[2].hex),
)
check(
  'scss and less lose nothing either',
  (buildScss(contested).match(/^\$[a-z0-9-]+: #/gm) || []).length === expectedDeclarations
  && (buildLess(contested).match(/^@[a-z0-9-]+: #/gm) || []).length === expectedDeclarations,
)

// The other half of the rule: a name that repeats with the SAME color is still
// one declaration, so percent naming does not double up on every base rung.
const percentSame = cssDeclarations(buildCss(paletteFor({ stepNaming: 'percent', nameStyle: 'index' })))
check(
  'an identical name and value is still deduped',
  percentSame.length === colorCount * stepsPerColor,
  `${percentSame.length} declarations`,
)

// 12. Raster quality domain --------------------------------------------------
section('12. Raster quality is a percent everywhere')

// The dial is a percent in the slider, in the stored options and in the default;
// the download call site divides by 100 exactly once. A default of 0.92 read as
// a percent encoded first-time JPGs at quality 0.0092.
const qualityFraction = (percent) => percent / 100

console.log(`  default ${RASTER_DEFAULTS.quality}%  range ${QUALITY_RANGE.min}-${QUALITY_RANGE.max}%  encoder ${qualityFraction(RASTER_DEFAULTS.quality)}`)

check(
  'the default sits inside the slider range',
  RASTER_DEFAULTS.quality >= QUALITY_RANGE.min && RASTER_DEFAULTS.quality <= QUALITY_RANGE.max,
  `${RASTER_DEFAULTS.quality}`,
)
check(
  'the modal divisor turns the range into 0.4 to 1.0',
  qualityFraction(QUALITY_RANGE.min) === 0.4 && qualityFraction(QUALITY_RANGE.max) === 1
  && qualityFraction(RASTER_DEFAULTS.quality) === 0.92,
)
check(
  'a stored fraction from an older build clamps to the slider minimum',
  clampQuality(0.92) === QUALITY_RANGE.min && mergeFormatOptions(exportFormatById('jpg'), { quality: 0.92 }).quality === QUALITY_RANGE.min,
)
check(
  'junk and out-of-range stored values are pulled back onto the range',
  clampQuality('nope') === RASTER_DEFAULTS.quality && clampQuality(400) === QUALITY_RANGE.max,
)
check(
  'a fresh session gets the default quality',
  mergeFormatOptions(exportFormatById('jpg')).quality === RASTER_DEFAULTS.quality,
)
check(
  'stored options still override everything else they carry',
  mergeFormatOptions(exportFormatById('jpg'), { scale: 3, quality: 70 }).scale === 3,
)

// 13. Version sync -----------------------------------------------------------
section('13. One version number, three places')

// The header badge, package.json and the changelog top entry must agree, and
// the number must move with the work rather than stall at the scaffold value.
const { readFileSync } = await import('node:fs')
const { VERSION } = await import('../src/data/version.js')
const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const changelogTop = (readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8').match(/^## \[(\d+\.\d+\.\d+)\]/m) || [])[1]

console.log(`  header ${VERSION}  package ${packageVersion}  changelog ${changelogTop}`)

check('semver shaped', /^\d+\.\d+\.\d+$/.test(VERSION))
check('header matches package.json', VERSION === packageVersion)
check('changelog top entry matches', changelogTop === packageVersion)

// ---------------------------------------------------------------------------
console.log(`\n${failures ? 'FAILED' : 'OK'}  ${checks - failures}/${checks} checks passed`)
process.exit(failures ? 1 : 0)
