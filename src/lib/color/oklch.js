// OKLab / OKLCH conversions (Ottosson's matrices) and sRGB gamut mapping.
// Every color value in the app passes through here. Out-of-gamut colors are
// resolved by lowering chroma at a fixed lightness and hue, never by clamping
// RGB channels: a per-channel clamp shifts hue, which is the artifact this tool
// exists to avoid.

// Below this chroma a color reads as gray and its hue is atan2 noise on a
// near-zero a/b pair. Both the neutral guard in harmonize and the "gray" name
// key off it, so it lives with the color math rather than in either consumer.
export const NEUTRAL_CHROMA_THRESHOLD = 0.02

const GAMUT_EPSILON = 1e-6
const MAX_SEARCHABLE_CHROMA = 0.5
const CHROMA_SEARCH_ITERATIONS = 22
const CUSP_SATURATION_SEARCH_ITERATIONS = 30
const CUSP_LUT_SIZE = 360
const HEX_PATTERN = /^#?([0-9a-f]+)$/i
const DEGREES_PER_RADIAN = 180 / Math.PI
const RADIANS_PER_DEGREE = Math.PI / 180

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function normalizeHue(hue) {
  const wrapped = hue % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

// Signed shortest way around the hue circle, in degrees, from one hue to another.
export function hueDelta(fromHue, toHue) {
  return ((toHue - fromHue + 540) % 360) - 180
}

export function srgbChannelToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
}

export function linearChannelToSrgb(channel) {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055
}

export function hexToRgb(hex) {
  if (typeof hex !== 'string') return null
  const match = HEX_PATTERN.exec(hex.trim())
  if (!match) return null
  let digits = match[1]
  if (digits.length === 3 || digits.length === 4) {
    digits = digits.slice(0, 3).split('').map((digit) => digit + digit).join('')
  } else if (digits.length === 8) {
    digits = digits.slice(0, 6)
  }
  if (digits.length !== 6) return null
  const value = parseInt(digits, 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function rgbToHex({ r, g, b }) {
  const channel = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function linearRgbToOklab({ r, g, b }) {
  const longCone = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const mediumCone = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const shortCone = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const longRoot = Math.cbrt(longCone)
  const mediumRoot = Math.cbrt(mediumCone)
  const shortRoot = Math.cbrt(shortCone)

  return {
    L: 0.2104542553 * longRoot + 0.793617785 * mediumRoot - 0.0040720468 * shortRoot,
    a: 1.9779984951 * longRoot - 2.428592205 * mediumRoot + 0.4505937099 * shortRoot,
    b: 0.0259040371 * longRoot + 0.7827717662 * mediumRoot - 0.808675766 * shortRoot,
  }
}

export function oklabToLinearRgb({ L, a, b }) {
  const longRoot = L + 0.3963377774 * a + 0.2158037573 * b
  const mediumRoot = L - 0.1055613458 * a - 0.0638541728 * b
  const shortRoot = L - 0.0894841775 * a - 1.291485548 * b

  const longCone = longRoot * longRoot * longRoot
  const mediumCone = mediumRoot * mediumRoot * mediumRoot
  const shortCone = shortRoot * shortRoot * shortRoot

  return {
    r: 4.0767416621 * longCone - 3.3077115913 * mediumCone + 0.2309699292 * shortCone,
    g: -1.2684380046 * longCone + 2.6097574011 * mediumCone - 0.3413193965 * shortCone,
    b: -0.0041960863 * longCone - 0.7034186147 * mediumCone + 1.707614701 * shortCone,
  }
}

export function rgbToOklab({ r, g, b }) {
  return linearRgbToOklab({
    r: srgbChannelToLinear(r / 255),
    g: srgbChannelToLinear(g / 255),
    b: srgbChannelToLinear(b / 255),
  })
}

export function oklabToRgb(lab) {
  const linear = oklabToLinearRgb(lab)
  return {
    r: clamp(linearChannelToSrgb(linear.r), 0, 1) * 255,
    g: clamp(linearChannelToSrgb(linear.g), 0, 1) * 255,
    b: clamp(linearChannelToSrgb(linear.b), 0, 1) * 255,
  }
}

export function oklabToOklch({ L, a, b }) {
  const C = Math.sqrt(a * a + b * b)
  const H = C < 1e-9 ? 0 : normalizeHue(Math.atan2(b, a) * DEGREES_PER_RADIAN)
  return { L, C, H }
}

export function oklchToOklab({ L, C, H }) {
  const radians = H * RADIANS_PER_DEGREE
  return { L, a: C * Math.cos(radians), b: C * Math.sin(radians) }
}

export function oklchToLinearRgb(color) {
  return oklabToLinearRgb(oklchToOklab(color))
}

export function oklchToRgb(color) {
  return oklabToRgb(oklchToOklab(color))
}

export function isInGamut(color) {
  const { r, g, b } = oklchToLinearRgb(color)
  const low = -GAMUT_EPSILON
  const high = 1 + GAMUT_EPSILON
  return r >= low && r <= high && g >= low && g <= high && b >= low && b <= high
}

// Largest chroma that still fits inside sRGB at this lightness and hue.
export function maxChroma(L, H) {
  if (!(L > 0) || L >= 1) return 0
  if (isInGamut({ L, C: MAX_SEARCHABLE_CHROMA, H })) return MAX_SEARCHABLE_CHROMA
  let inside = 0
  let outside = MAX_SEARCHABLE_CHROMA
  for (let i = 0; i < CHROMA_SEARCH_ITERATIONS; i++) {
    const middle = (inside + outside) / 2
    if (isInGamut({ L, C: middle, H })) inside = middle
    else outside = middle
  }
  return inside
}

export function clampChroma(color) {
  const C = Math.max(0, color.C)
  const candidate = { L: color.L, C, H: normalizeHue(color.H) }
  if (isInGamut(candidate)) return candidate
  return { ...candidate, C: maxChroma(candidate.L, candidate.H) }
}

// The sRGB solid is a cone from the OKLab origin, so along one hue the boundary
// is found by pushing saturation (chroma per unit lightness) until a linear
// channel crosses zero, then rescaling so the largest channel lands on 1.
function findHueCusp(hue) {
  const radians = hue * RADIANS_PER_DEGREE
  const aUnit = Math.cos(radians)
  const bUnit = Math.sin(radians)
  let inside = 0
  let outside = 2
  for (let i = 0; i < CUSP_SATURATION_SEARCH_ITERATIONS; i++) {
    const middle = (inside + outside) / 2
    const linear = oklabToLinearRgb({ L: 1, a: aUnit * middle, b: bUnit * middle })
    if (Math.min(linear.r, linear.g, linear.b) < 0) outside = middle
    else inside = middle
  }
  const linear = oklabToLinearRgb({ L: 1, a: aUnit * inside, b: bUnit * inside })
  const scale = Math.cbrt(1 / Math.max(linear.r, linear.g, linear.b))
  return { L: scale, C: scale * inside }
}

// Built once at module load: the cusp is read per color per render, and the
// search behind it is far too heavy to run at slider frame rate.
const HUE_CUSP_LUT = (() => {
  const table = new Array(CUSP_LUT_SIZE)
  for (let hue = 0; hue < CUSP_LUT_SIZE; hue++) table[hue] = findHueCusp(hue)
  return table
})()

function readCuspLut(hue, field) {
  const position = normalizeHue(hue)
  const lowIndex = Math.floor(position)
  const highIndex = (lowIndex + 1) % CUSP_LUT_SIZE
  const blend = position - lowIndex
  const low = HUE_CUSP_LUT[lowIndex % CUSP_LUT_SIZE][field]
  const high = HUE_CUSP_LUT[highIndex][field]
  return low + (high - low) * blend
}

// Lightness at which this hue reaches its most saturated sRGB color
// (red ~0.63, yellow ~0.97, blue ~0.45).
export function cuspLightness(hue) {
  return readCuspLut(hue, 'L')
}

export function cuspChroma(hue) {
  return readCuspLut(hue, 'C')
}

export function oklchToHex(color) {
  if (color.L >= 1) return '#ffffff'
  if (color.L <= 0) return '#000000'
  return rgbToHex(oklchToRgb(clampChroma(color)))
}

export function hexToOklch(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return oklabToOklch(rgbToOklab(rgb))
}
