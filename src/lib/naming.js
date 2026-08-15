// Names and export tokens for palette entries.

import { NEUTRAL_CHROMA_THRESHOLD, hueDelta } from './color/oklch.js'

// OKLCH hue anchors, not HSL ones: pure red sits at 29deg here, yellow at 110,
// blue at 264. Each name owns the arc nearest its anchor.
export const HUE_NAME_ANCHORS = [
  { hue: 10, name: 'rose' },
  { hue: 29, name: 'red' },
  { hue: 55, name: 'orange' },
  { hue: 75, name: 'amber' },
  { hue: 110, name: 'yellow' },
  { hue: 130, name: 'lime' },
  { hue: 145, name: 'green' },
  { hue: 162, name: 'emerald' },
  { hue: 185, name: 'teal' },
  { hue: 200, name: 'cyan' },
  { hue: 228, name: 'sky' },
  { hue: 264, name: 'blue' },
  { hue: 285, name: 'indigo' },
  { hue: 305, name: 'violet' },
  { hue: 322, name: 'purple' },
  { hue: 335, name: 'magenta' },
  { hue: 350, name: 'pink' },
]

export const NEUTRAL_NAME = 'gray'

// Tailwind's ladder: 11 stops, which is exactly what +/-50% in 10% steps gives.
const TOKEN_LADDER = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const TOKEN_ROUNDING = 25

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function hueName(H, C = 1) {
  if (C < NEUTRAL_CHROMA_THRESHOLD) return NEUTRAL_NAME
  let closest = HUE_NAME_ANCHORS[0]
  let smallestDistance = Infinity
  for (const anchor of HUE_NAME_ANCHORS) {
    const distance = Math.abs(hueDelta(H, anchor.hue))
    if (distance < smallestDistance) {
      smallestDistance = distance
      closest = anchor
    }
  }
  return closest.name
}

// A leading digit is legal in a CSS custom property but not in a SCSS or LESS
// identifier: dart-sass rejects `$2024-1` outright. One letter in front fixes
// it, and it goes on in every dialect so a palette named "2024" exports the
// same token names whatever the file extension is.
const DIGIT_LEADING = /^\d/
const IDENTIFIER_LEAD_IN = 'c'

export function sanitizeLabel(label) {
  const sanitized = String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return DIGIT_LEADING.test(sanitized) ? `${IDENTIFIER_LEAD_IN}${sanitized}` : sanitized
}

// Repeats get -2, -3 ... in palette order; the first of a name keeps it bare.
export function dedupeNames(names) {
  const used = new Map()
  return names.map((name) => {
    const seen = used.get(name) || 0
    used.set(name, seen + 1)
    if (seen === 0) return name
    let candidate = `${name}-${seen + 1}`
    let suffix = seen + 1
    while (used.has(candidate)) {
      suffix += 1
      candidate = `${name}-${suffix}`
    }
    used.set(candidate, 1)
    return candidate
  })
}

// Signed step percent (positive = lighter) to a 50-950 token. The default
// ladder lands on the canonical stops exactly; other step counts interpolate.
export function tokenScale(percent, maxPercent) {
  if (!maxPercent) return 500
  const position = clamp(-percent / maxPercent, -1, 1)
  const ladderPosition = ((position + 1) / 2) * (TOKEN_LADDER.length - 1)
  const lowIndex = Math.floor(ladderPosition)
  if (lowIndex >= TOKEN_LADDER.length - 1) return TOKEN_LADDER[TOKEN_LADDER.length - 1]
  const blend = ladderPosition - lowIndex
  const value = TOKEN_LADDER[lowIndex] + (TOKEN_LADDER[lowIndex + 1] - TOKEN_LADDER[lowIndex]) * blend
  return Math.round(value / TOKEN_ROUNDING) * TOKEN_ROUNDING
}

// Suffix appended to a color token for one step; null means the step needs no
// suffix at all (the base color in percent naming is just "red").
export function stepSuffix(percent, maxPercent, stepNaming = 'scale') {
  if (stepNaming === 'percent') {
    if (!percent) return null
    return `${percent > 0 ? 'l' : 'd'}${Math.abs(percent)}`
  }
  return String(tokenScale(percent, maxPercent))
}

export function joinToken(...parts) {
  return parts.filter((part) => part !== null && part !== undefined && part !== '').join('-')
}
