// Tint/shade ladder for one base color.
// "10% lighter" means 10% of the remaining distance to white, so a near-white
// base still yields a usable ladder instead of nine copies of #ffffff. Chroma is
// held at the base value and gamut-clamped per step, which keeps the middle of
// the ladder vivid and lets the ends soften on their own.

import { oklchToHex } from './color/oklch.js'

// The ladder never reaches pure white or black; 95% of the way is the stop.
export const MAX_STEP_FRACTION = 0.95

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function stepLightness(L, fraction) {
  const amount = clamp(fraction, -MAX_STEP_FRACTION, MAX_STEP_FRACTION)
  return amount >= 0 ? L + (1 - L) * amount : L * (1 + amount)
}

// Pastel tints: the lighter half loses chroma toward the top of the ladder,
// which is the classic tint look. Shades keep their chroma and are softened
// only by the gamut itself.
function taperedChroma(C, fraction, chromaTaper) {
  if (chromaTaper <= 0 || fraction <= 0) return C
  const reach = clamp(fraction, 0, MAX_STEP_FRACTION) / MAX_STEP_FRACTION
  return C * (1 - chromaTaper * reach)
}

export function buildScale(base, { stepPercent = 10, stepCount = 4, chromaTaper = 0 } = {}) {
  const steps = Math.max(0, Math.round(stepCount))
  const percent = Math.max(0, stepPercent)
  const taper = clamp(chromaTaper, 0, 0.5)

  const ladder = []
  for (let offset = steps; offset >= -steps; offset--) {
    const pct = offset * percent
    const fraction = pct / 100
    const L = stepLightness(base.L, fraction)
    const C = taperedChroma(base.C, fraction, taper)
    const color = { L, C, H: base.H }
    ladder.push({ pct, L, C, H: base.H, hex: oklchToHex(color), isBase: offset === 0, collapsed: false })
  }

  // Past the 95% stop (or on a near-white base) neighbouring steps can resolve
  // to the same hex; flag them so the UI can badge the duplicate rather than
  // showing two identical swatches.
  const baseIndex = steps
  for (let index = baseIndex - 1; index >= 0; index--) {
    if (ladder[index].hex === ladder[index + 1].hex) ladder[index].collapsed = true
  }
  for (let index = baseIndex + 1; index < ladder.length; index++) {
    if (ladder[index].hex === ladder[index - 1].hex) ladder[index].collapsed = true
  }

  return ladder
}
