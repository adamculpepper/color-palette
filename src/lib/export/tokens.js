// JSON design tokens: W3C DTCG by default, or a flat name-to-value map for
// tools that just want a dictionary.

import { formatColor } from '../color/format.js'
import { exportUnit, stepKey } from './code.js'

const DTCG_TYPE = 'color'
const JSON_INDENT = 2

export function dtcgTokens(palette, options = {}) {
  const unit = exportUnit(palette, options)
  const tokens = {}

  for (const color of palette?.colors ?? []) {
    const group = {}
    for (const step of color.steps) {
      group[stepKey(color.token, step.token)] = {
        $type: DTCG_TYPE,
        $value: formatColor(step.oklch, unit),
      }
    }
    tokens[color.token] = group
  }

  return tokens
}

export function flatTokens(palette, options = {}) {
  const unit = exportUnit(palette, options)
  const tokens = {}

  for (const color of palette?.colors ?? []) {
    for (const step of color.steps) {
      tokens[step.token] = formatColor(step.oklch, unit)
    }
  }

  return tokens
}

export function buildTokens(palette, options = {}) {
  const { flat = false } = options
  const tokens = flat ? flatTokens(palette, options) : dtcgTokens(palette, options)
  return `${JSON.stringify(tokens, null, JSON_INDENT)}\n`
}
