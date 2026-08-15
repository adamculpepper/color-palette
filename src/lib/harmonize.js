// The adjustment pipeline: palette in, palette out, pure.
// Filters run in a fixed order and the result is gamut-clamped exactly once at
// the end, because clamping between filters compounds the error.

import {
  NEUTRAL_CHROMA_THRESHOLD,
  clampChroma,
  hueDelta,
  normalizeHue,
  oklabToOklch,
  oklchToOklab,
} from './color/oklch.js'

// preserveNeutrals holds gray out of the hue and chroma filters: dragged toward
// a mean chroma, #c9c9c9 turns beige on atan2 noise alone.

// Full warm/cool is a small OKLab offset; anything larger swamps the palette.
const TEMPERATURE_OFFSET_RANGE = 0.05

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

// Hue is circular, so the average of 350deg and 10deg is 0deg, not 180deg.
export function circularMeanHue(hues) {
  if (!hues.length) return 0
  let x = 0
  let y = 0
  for (const hue of hues) {
    const radians = (hue * Math.PI) / 180
    x += Math.cos(radians)
    y += Math.sin(radians)
  }
  if (Math.abs(x) < 1e-12 && Math.abs(y) < 1e-12) return normalizeHue(hues[0])
  return normalizeHue((Math.atan2(y, x) * 180) / Math.PI)
}

export function harmonize(colors, {
  hueRotate = 0,
  hueConverge = 0,
  temperature = 0,
  chromaScale = 1,
  chromaConverge = 0,
  lightnessShift = 0,
  lightnessSpread = 0,
  preserveNeutrals = true,
} = {}) {
  if (!Array.isArray(colors) || !colors.length) return []

  // Tunability is decided once from the incoming palette: if it were re-tested
  // between filters, a color could cross the neutral threshold mid-pipeline and
  // pick up half the adjustments.
  const isTunable = colors.map((color) => !preserveNeutrals || color.C >= NEUTRAL_CHROMA_THRESHOLD)
  const tunableIndexes = isTunable.reduce((list, tunable, index) => {
    if (tunable) list.push(index)
    return list
  }, [])

  let working = colors.map((color) => ({ L: color.L, C: Math.max(0, color.C), H: normalizeHue(color.H) }))
  const adjust = (transform) => {
    working = working.map((color, index) => (isTunable[index] ? transform(color) : color))
  }

  if (hueRotate) {
    adjust((color) => ({ ...color, H: normalizeHue(color.H + hueRotate) }))
  }

  if (hueConverge > 0 && tunableIndexes.length > 1) {
    const meanHue = circularMeanHue(tunableIndexes.map((index) => working[index].H))
    const amount = clamp(hueConverge, 0, 1)
    adjust((color) => ({ ...color, H: normalizeHue(color.H + hueDelta(color.H, meanHue) * amount) }))
  }

  if (temperature) {
    // An a/b-plane offset rather than a hue rotation: warming stays warming no
    // matter what hueRotate did first.
    const offset = clamp(temperature, -1, 1) * TEMPERATURE_OFFSET_RANGE
    adjust((color) => {
      const lab = oklchToOklab(color)
      return oklabToOklch({ L: lab.L, a: lab.a + offset, b: lab.b + offset })
    })
  }

  if (chromaScale !== 1) {
    const scale = Math.max(0, chromaScale)
    adjust((color) => ({ ...color, C: color.C * scale }))
  }

  if (chromaConverge > 0 && tunableIndexes.length > 1) {
    const meanChroma = mean(tunableIndexes.map((index) => working[index].C))
    const amount = clamp(chromaConverge, 0, 1)
    adjust((color) => ({ ...color, C: color.C + (meanChroma - color.C) * amount }))
  }

  if (lightnessShift) {
    working = working.map((color) => ({ ...color, L: color.L + lightnessShift }))
  }

  if (lightnessSpread && working.length > 1) {
    const meanLightness = mean(working.map((color) => color.L))
    const spread = 1 + clamp(lightnessSpread, -1, 1)
    working = working.map((color) => ({
      ...color,
      L: meanLightness + (color.L - meanLightness) * spread,
    }))
  }

  return working.map((color) => clampChroma({
    L: clamp(color.L, 0, 1),
    C: Math.max(0, color.C),
    H: color.H,
  }))
}
