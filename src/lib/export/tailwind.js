// Tailwind theme fragment. The nested colors object is built first as plain
// data (so it can be asserted directly) and serialized second, which keeps the
// quoting rules in one place.

import { formatColor } from '../color/format.js'
import { exportUnit, paletteSummary, stepKey } from './code.js'

// Tailwind reads the unsuffixed shade of a scale from the DEFAULT key, which is
// exactly what percent step naming leaves on the base step.
const TAILWIND_BASE_KEY = 'DEFAULT'
const BARE_KEY_PATTERN = /^(?:[A-Za-z_$][A-Za-z0-9_$]*|[0-9]+)$/
const INDENT = '  '

export function tailwindColors(palette, options = {}) {
  const unit = exportUnit(palette, options)
  const colors = {}

  for (const color of palette?.colors ?? []) {
    const shades = {}
    for (const step of color.steps) {
      const key = stepKey(color.token, step.token)
      shades[key === 'base' ? TAILWIND_BASE_KEY : key] = formatColor(step.oklch, unit)
    }
    colors[color.token] = shades
  }

  return colors
}

function serializeKey(key) {
  return BARE_KEY_PATTERN.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`
}

function serializeObject(value, depth) {
  const pad = INDENT.repeat(depth)
  const innerPad = INDENT.repeat(depth + 1)
  const entries = Object.entries(value)
  if (entries.length === 0) return '{}'

  const lines = entries.map(([key, entry]) => {
    const serialized = typeof entry === 'object' && entry !== null
      ? serializeObject(entry, depth + 1)
      : `'${String(entry).replace(/'/g, "\\'")}'`
    return `${innerPad}${serializeKey(key)}: ${serialized},`
  })

  return `{\n${lines.join('\n')}\n${pad}}`
}

export function buildTailwind(palette, options = {}) {
  const { wrapModule = true } = options
  const unit = exportUnit(palette, options)
  const colors = tailwindColors(palette, options)
  const header = `// ${paletteSummary(palette, unit)}`

  if (!wrapModule) {
    return `${header}\n${serializeObject(colors, 0)}\n`
  }

  // Depth 3 puts the closing brace under `colors:`, which sits three indents in.
  const body = serializeObject(colors, 3)
  return [
    header,
    'module.exports = {',
    `${INDENT}theme: {`,
    `${INDENT.repeat(2)}extend: {`,
    `${INDENT.repeat(3)}colors: ${body},`,
    `${INDENT.repeat(2)}},`,
    `${INDENT}},`,
    '}',
    '',
  ].join('\n')
}
