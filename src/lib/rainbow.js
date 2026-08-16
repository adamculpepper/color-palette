// Generator: rainbow parameters in, base OKLCH colors out.
// A rainbow is an arc of the hue circle, not the whole wheel: the default
// 29deg -> 310deg run reads red -> violet, while a full 360deg sweep reads as a
// color wheel (first and last stop meet).
//
// Harmony picks how the hues are chosen. Two modes sweep an arc (spectrum takes
// the spread as given, analogous caps it at a tight fan); the rest place every
// color on a fixed set of hue anchors measured from the start hue, which is the
// classic color-wheel relationship a designer means by complementary or triad.

import { clampChroma, cuspLightness, maxChroma, normalizeHue } from './color/oklch.js'

export const DEFAULT_START_HUE = 29
export const DEFAULT_HUE_SPREAD = 281

// Flat lightness renders yellow as brown, so "natural" lightness follows each
// hue's gamut cusp and is only pulled part of the way toward the target.
export const NATURAL_LIGHTNESS_FLATTEN = 0.35

// Offsets in degrees from the start hue. Tetrad is listed 0/90/270/180 rather
// than in wheel order so that neighbouring colors in the output land on opposite
// sides of the wheel instead of marching around it one quarter at a time.
export const HARMONY_OFFSETS = {
  complementary: [0, 180],
  split: [0, 150, 210],
  triad: [0, 120, 240],
  tetrad: [0, 90, 270, 180],
  monochrome: [0],
}

export const SWEEP_HARMONIES = ['spectrum', 'analogous']
export const HARMONY_NAMES = [...SWEEP_HARMONIES, ...Object.keys(HARMONY_OFFSETS)]

// Analogous is the "neighbouring hues" harmony, so the arc is a fan rather than
// a sweep. The spread slider is still honoured below this.
export const ANALOGOUS_MAX_SPREAD = 90

const MIN_STOP_LIGHTNESS = 0.02
const MAX_STOP_LIGHTNESS = 0.99

// An anchor holds fewer hues than the palette holds colors, so the extra colors
// land on an anchor a second and third time and have to be told apart. Lightness
// fans out around the anchor's own base in alternating steps of growing size
// (base, up, down, further up, further down), and chroma steps down once per
// pass, so the first color on an anchor is the mode's intended color and every
// later one reads as a supporting tone of it.
//
// The step shrinks as the fan grows so 24 colors on one anchor still fit inside
// the half-span, and the whole fan slides when it would otherwise run past the
// usable band. Past the band a stop has no chroma left to carry its hue, which
// is how a monochrome red ends up with a white and a black in it.
const REPEAT_LIGHTNESS_STEP = 0.075
const REPEAT_LIGHTNESS_HALF_SPAN = 0.3
const REPEAT_LIGHTNESS_FLOOR = 0.14
const REPEAT_LIGHTNESS_CEILING = 0.92
const REPEAT_CHROMA_TAPER = 0.07
const MAX_REPEAT_CHROMA_TAPER = 0.45

const HUE_EASINGS = {
  linear: (position) => position,
  easeIn: (position) => position * position,
  easeOut: (position) => 1 - (1 - position) * (1 - position),
  easeInOut: (position) => (position < 0.5
    ? 2 * position * position
    : 1 - 2 * (1 - position) * (1 - position)),
}

export const HUE_EASING_NAMES = Object.keys(HUE_EASINGS)

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

function baseLightnessFor(hue, { lightnessMode, targetLightness, lightnessFlatten }) {
  if (lightnessMode === 'flat') return targetLightness
  const naturalLightness = cuspLightness(hue)
  return naturalLightness + (targetLightness - naturalLightness) * clamp(lightnessFlatten, 0, 1)
}

// The fan of lightness offsets for one anchor, in pass order.
function repeatLightnessOffsets(repeatCount, anchorLightness) {
  const widest = Math.ceil(Math.max(0, repeatCount - 1) / 2)
  const step = widest < 1
    ? 0
    : Math.min(REPEAT_LIGHTNESS_STEP, REPEAT_LIGHTNESS_HALF_SPAN / widest)

  const offsets = []
  for (let repeat = 0; repeat < repeatCount; repeat++) {
    const magnitude = Math.ceil(repeat / 2) * step
    offsets.push(repeat % 2 === 1 ? magnitude : -magnitude)
  }

  const lowest = anchorLightness + Math.min(...offsets)
  const highest = anchorLightness + Math.max(...offsets)
  const shift = lowest < REPEAT_LIGHTNESS_FLOOR
    ? REPEAT_LIGHTNESS_FLOOR - lowest
    : highest > REPEAT_LIGHTNESS_CEILING
      ? REPEAT_LIGHTNESS_CEILING - highest
      : 0

  return shift === 0 ? offsets : offsets.map((offset) => offset + shift)
}

function repeatChromaScale(repeat) {
  return 1 - Math.min(MAX_REPEAT_CHROMA_TAPER, repeat * REPEAT_CHROMA_TAPER)
}

// One entry per output color: which hue it sits on and how far its lightness and
// chroma move off that hue's base. Sweeps never move either.
function sweepPlacements(stopCount, { startHue, hueSpread, direction, hueEasing, harmony }) {
  const requested = clamp(hueSpread, 0, 360)
  const span = harmony === 'analogous' ? Math.min(requested, ANALOGOUS_MAX_SPREAD) : requested
  const ease = HUE_EASINGS[hueEasing] || HUE_EASINGS.linear
  const sweepSign = direction === 'ccw' ? -1 : 1

  // A closed 360deg wheel divides by the stop count so the last stop lands one
  // interval before the first; an open arc divides by the gaps between stops.
  const hueDivisor = stopCount === 1 ? 1 : span >= 360 ? stopCount : stopCount - 1

  const placements = []
  for (let index = 0; index < stopCount; index++) {
    const huePosition = stopCount === 1 ? 0 : index / hueDivisor
    placements.push({
      H: normalizeHue(startHue + sweepSign * span * ease(huePosition)),
      lightnessOffset: 0,
      chromaScale: 1,
    })
  }
  return placements
}

// Colors go round the anchors one at a time, so 7 colors over 3 anchors land
// 3/2/2 and neighbouring colors in the row always sit on different hues.
function anchorPlacements(stopCount, { startHue, harmony, lightness }) {
  const offsets = HARMONY_OFFSETS[harmony]
  const anchorCount = offsets.length
  const placements = new Array(stopCount)

  for (let anchor = 0; anchor < anchorCount && anchor < stopCount; anchor++) {
    const H = normalizeHue(startHue + offsets[anchor])
    const repeatCount = Math.ceil((stopCount - anchor) / anchorCount)
    const lightnessOffsets = repeatLightnessOffsets(repeatCount, baseLightnessFor(H, lightness))

    for (let repeat = 0; repeat < repeatCount; repeat++) {
      placements[anchor + repeat * anchorCount] = {
        H,
        lightnessOffset: lightnessOffsets[repeat],
        chromaScale: repeatChromaScale(repeat),
      }
    }
  }
  return placements
}

export function generateRainbow({
  count = 7,
  startHue = DEFAULT_START_HUE,
  hueSpread = DEFAULT_HUE_SPREAD,
  direction = 'cw',
  lightnessMode = 'natural',
  lightness = 0.72,
  lightnessFlatten = NATURAL_LIGHTNESS_FLATTEN,
  chromaMode = 'vivid',
  chromaFactor = 0.8,
  lightnessArc = 0,
  chromaArc = 0,
  hueEasing = 'linear',
  harmony = 'spectrum',
} = {}) {
  const stopCount = Math.max(1, Math.round(count))
  const lightnessSettings = {
    lightnessMode,
    targetLightness: clamp(lightness, 0, 1),
    lightnessFlatten,
  }

  const placements = HARMONY_OFFSETS[harmony]
    ? anchorPlacements(stopCount, { startHue, harmony, lightness: lightnessSettings })
    : sweepPlacements(stopCount, { startHue, hueSpread, direction, hueEasing, harmony })

  const stops = placements.map(({ H, lightnessOffset, chromaScale }, index) => {
    const arcPosition = stopCount === 1 ? 0 : index / (stopCount - 1)
    const bow = Math.sin(Math.PI * arcPosition)

    const baseLightness = baseLightnessFor(H, lightnessSettings) + lightnessOffset
    const L = clamp(baseLightness + lightnessArc * bow, MIN_STOP_LIGHTNESS, MAX_STOP_LIGHTNESS)

    return { L, H, bow, chromaScale, headroom: maxChroma(L, H) }
  })

  // "even" chroma holds every hue at the sweep's tightest headroom, because the
  // sRGB maximum varies close to 2x across hues at one lightness.
  const evenHeadroom = stops.reduce((lowest, stop) => Math.min(lowest, stop.headroom), Infinity)

  return stops.map(({ L, H, bow, chromaScale, headroom }) => {
    const headroomForMode = chromaMode === 'even' ? evenHeadroom : headroom
    const C = Math.max(0, chromaFactor * headroomForMode * (1 + chromaArc * bow) * chromaScale)
    return clampChroma({ L, C, H })
  })
}
