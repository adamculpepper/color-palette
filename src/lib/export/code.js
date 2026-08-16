// CSS, SCSS and LESS are one emitter driven by a descriptor table: everything
// that differs between the three preprocessors is a field in DIALECTS, so a
// fourth one is a table entry rather than a new builder.
//
// Every value is read from the palette's OKLCH numbers through formatColor, not
// from the hex string, so oklch()/oklab() output keeps the precision the engine
// computed.

import { formatColor } from '../color/format.js'
import { sanitizeLabel } from '../naming.js'

const FALLBACK_PREFIX = 'color'
const BASE_MAP_KEY = 'base'
const MAP_INDENT = '  '
// Maps hold a whole ladder rather than one value, so they claim their name in
// the declared table under a marker that can never equal a formatted color.
const MAP_DECLARATION = Symbol('map')

const DIALECTS = {
  css: {
    variablePrefix: '--',
    comment: (text) => `/* ${text} */`,
    blockOpen: ':root {',
    blockClose: '}',
    indent: '  ',
    maps: false,
  },
  scss: {
    variablePrefix: '$',
    comment: (text) => `// ${text}`,
    blockOpen: null,
    blockClose: null,
    indent: '',
    maps: true,
  },
  less: {
    variablePrefix: '@',
    comment: (text) => `// ${text}`,
    blockOpen: null,
    blockClose: null,
    indent: '',
    maps: false,
  },
}

export function exportUnit(palette, options = {}) {
  return options.unit || palette?.meta?.colorFormat || 'hex'
}

// The base aliases and the SCSS collection map are named from the same prefix
// the Naming section owns, so typing "rainbow" there yields --rainbow-1.
export function basePrefix(palette) {
  return sanitizeLabel(palette?.meta?.namePrefix) || FALLBACK_PREFIX
}

// The part of a step token that identifies the step inside its color: "red-500"
// under "red" is "500". Percent naming leaves the base step unsuffixed, which
// maps and nested objects still need a key for.
export function stepKey(colorToken, stepToken) {
  if (stepToken === colorToken) return BASE_MAP_KEY
  return stepToken.startsWith(`${colorToken}-`) ? stepToken.slice(colorToken.length + 1) : stepToken
}

export function paletteSummary(palette, unit) {
  const colors = palette?.colors ?? []
  const steps = colors[0]?.steps.length ?? 0
  return `Color palette: ${colors.length} colors, ${steps} steps each, ${unit} values`
}

function emitDialect(dialect, palette, options = {}) {
  const unit = exportUnit(palette, options)
  const colors = palette?.colors ?? []
  const prefix = basePrefix(palette)
  const { indent } = dialect

  const lines = [dialect.comment(paletteSummary(palette, unit)), '']
  const declared = new Map()

  // Percent step naming can make a base step token identical to its own base
  // alias. When both carry the same color the first declaration wins and the
  // duplicate is dropped.
  //
  // When they carry DIFFERENT colors the name is contested rather than
  // duplicated — a prefix of "red" over a palette holding red-2 collides the
  // alias --red-2 with the real red-2 — and dropping it would silently delete a
  // color from the export. The later declaration takes the next free numeric
  // suffix instead, so every color always ships.
  const declare = (token, value) => {
    const existing = declared.get(token)
    if (existing === value) return
    let name = token
    if (existing !== undefined) {
      let suffix = 2
      while (declared.has(`${token}-${suffix}`)) suffix += 1
      name = `${token}-${suffix}`
    }
    declared.set(name, value)
    lines.push(`${indent}${dialect.variablePrefix}${name}: ${value};`)
  }

  if (dialect.blockOpen) lines.push(dialect.blockOpen)

  lines.push(`${indent}${dialect.comment(`base aliases, 1 to ${colors.length}`)}`)
  colors.forEach((color, index) => {
    declare(`${prefix}-${index + 1}`, formatColor(color.base, unit))
  })

  for (const color of colors) {
    lines.push('')
    lines.push(`${indent}${dialect.comment(color.name)}`)
    for (const step of color.steps) declare(step.token, formatColor(step.oklch, unit))
  }

  if (dialect.blockClose) lines.push(dialect.blockClose)

  if (dialect.maps && colors.length) {
    lines.push('')
    lines.push(dialect.comment('maps'))

    for (const color of colors) {
      // A flat variable already holding the bare name (percent naming) keeps it;
      // the map takes the -scale name so neither declaration is lost.
      const mapName = declared.has(color.token) ? `${color.token}-scale` : color.token
      declared.set(mapName, MAP_DECLARATION)
      const entries = color.steps.map(
        (step) => `${MAP_INDENT}${stepKey(color.token, step.token)}: ${formatColor(step.oklch, unit)}`,
      )
      lines.push(`${dialect.variablePrefix}${mapName}: (`)
      lines.push(entries.join(',\n'))
      lines.push(');')
    }

    const collectionName = declared.has(prefix) ? `${prefix}-scale` : prefix
    declared.set(collectionName, MAP_DECLARATION)
    lines.push(`${dialect.variablePrefix}${collectionName}: (`)
    lines.push(
      colors.map((color, index) => `${MAP_INDENT}${index + 1}: ${formatColor(color.base, unit)}`).join(',\n'),
    )
    lines.push(');')
  }

  return `${lines.join('\n')}\n`
}

export function buildCss(palette, options) {
  return emitDialect(DIALECTS.css, palette, options)
}

export function buildScss(palette, options) {
  return emitDialect(DIALECTS.scss, palette, options)
}

export function buildLess(palette, options) {
  return emitDialect(DIALECTS.less, palette, options)
}
