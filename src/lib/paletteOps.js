// Reshaping operations behind the stage toolbar buttons. Each one takes the
// base ramp as hex strings and returns a new array of the same length, which
// the caller hands to replaceColors — that call is what forks a generated
// palette into a custom one.
//
// The hexes handed in are the PRE-adjustment values (PaletteModel's sourceHex),
// never what the grid is showing: the result becomes customColors, and
// buildPalette runs the adjustments over customColors again.
//
// Pure, no React, no state: the toolbar decides when to run these, the reducer
// decides what to do with the result.

import {
  NEUTRAL_CHROMA_THRESHOLD,
  hexToOklch,
  hueDelta,
  normalizeHue,
  oklchToHex,
} from './color/oklch.js'

const MIN_DISTRIBUTABLE_COLORS = 3
// Two chromatic swatches are the endpoints of the sweep and never move, so
// anything below that has no hue path to space anything across.
const MIN_SPACEABLE_COLORS = 2

// Below the neutral threshold a color's hue is atan2 noise, so it can neither
// be sorted by hue nor meaningfully interpolated toward.
function isNeutral(color) {
  return !color || color.C < NEUTRAL_CHROMA_THRESHOLD
}

export function sortByHue(hexes) {
  const entries = hexes.map((hex) => ({ hex, color: hexToOklch(hex) }))

  // Array.sort is stable, so neutrals and equal hues keep the order they came in.
  entries.sort((first, second) => {
    const firstIsNeutral = isNeutral(first.color)
    const secondIsNeutral = isNeutral(second.color)
    if (firstIsNeutral !== secondIsNeutral) return firstIsNeutral ? 1 : -1
    if (firstIsNeutral && secondIsNeutral) return 0
    return first.color.H - second.color.H
  })

  return entries.map((entry) => entry.hex)
}

export function reverseColors(hexes) {
  return [...hexes].reverse()
}

// Even hue spacing between the first and last chromatic color. Only hue moves:
// pulling lightness onto the same straight line would drag yellow down toward
// the endpoints and render it brown, the exact artifact the generator avoids.
//
// Neutrals are excluded from the path entirely rather than merely skipped when
// writing the result. Their hue is atan2 noise, so a gray sitting at either end
// would hand the whole sweep a meaningless start or travel — #c9c9c9 and
// #c9c9ca are the same color to the eye and 100+ degrees apart to atan2, which
// is enough to send every chromatic swatch somewhere else.
export function distributeEvenly(hexes) {
  if (hexes.length < MIN_DISTRIBUTABLE_COLORS) return [...hexes]

  const colors = hexes.map(hexToOklch)
  if (colors.some((color) => !color)) return [...hexes]

  const chromatic = colors
    .map((color, index) => ({ color, index }))
    .filter((entry) => !isNeutral(entry.color))
  if (chromatic.length < MIN_SPACEABLE_COLORS) return [...hexes]

  // The hue path is unwrapped by accumulating signed steps, so the sweep keeps
  // the direction and total travel it already has. Reading the endpoints alone
  // would take the shortest arc and send a red-to-violet rainbow backwards
  // through pink.
  const huePath = [chromatic[0].color.H]
  for (let position = 1; position < chromatic.length; position++) {
    huePath.push(
      huePath[position - 1]
      + hueDelta(chromatic[position - 1].color.H, chromatic[position].color.H),
    )
  }

  const start = huePath[0]
  const travel = huePath[huePath.length - 1] - start
  const stride = travel / (chromatic.length - 1)

  // Neutrals keep their hex and their place in the palette; the chromatic
  // swatches redistribute across the path the chromatic swatches described.
  const spaced = [...hexes]
  chromatic.forEach((entry, position) => {
    spaced[entry.index] = oklchToHex({
      L: entry.color.L,
      C: entry.color.C,
      H: normalizeHue(start + stride * position),
    })
  })
  return spaced
}

// Halfway between two colors in OKLCH, used for the swatch editor's
// "Insert after". A neutral neighbour contributes no usable hue, so the
// chromatic side's hue carries the new color.
export function midpointHex(firstHex, secondHex) {
  const first = hexToOklch(firstHex)
  const second = hexToOklch(secondHex)
  if (!first) return secondHex
  if (!second) return firstHex

  let hue
  if (isNeutral(first) && isNeutral(second)) hue = first.H
  else if (isNeutral(first)) hue = second.H
  else if (isNeutral(second)) hue = first.H
  else hue = normalizeHue(first.H + hueDelta(first.H, second.H) / 2)

  return oklchToHex({ L: (first.L + second.L) / 2, C: (first.C + second.C) / 2, H: hue })
}
