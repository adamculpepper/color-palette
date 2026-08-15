// One serializer for every color the app prints: swatch labels, editor
// readouts, and all code exports go through formatColor so the whole app speaks
// one dialect. Values come off the internal OKLCH/sRGB pair rather than a
// re-parsed hex string, so oklch and oklab output keep their precision.

import {
  clampChroma,
  hexToRgb,
  normalizeHue,
  oklabToOklch,
  oklchToOklab,
  oklchToRgb,
  rgbToHex,
  rgbToOklab,
} from './oklch.js'

export const COLOR_UNITS = ['hex', 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'oklch', 'oklab']

const OPAQUE_ALPHA = 1
const OKLCH_DECIMALS = 3
const HUE_DECIMALS = 1

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

// Fixed decimals with the trailing zeros trimmed: 0.620 prints as 0.62, but
// 0.191 keeps every digit that carries information.
function trimNumber(value, decimals) {
  const text = value.toFixed(decimals)
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text
}

function roundChannel(value) {
  return clamp(Math.round(value), 0, 255)
}

export function rgbToHsl({ r, g, b }) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const high = Math.max(red, green, blue)
  const low = Math.min(red, green, blue)
  const range = high - low
  const lightness = (high + low) / 2

  let hue = 0
  if (range > 0) {
    if (high === red) hue = ((green - blue) / range) % 6
    else if (high === green) hue = (blue - red) / range + 2
    else hue = (red - green) / range + 4
    hue *= 60
  }

  const saturation = range === 0 ? 0 : range / (1 - Math.abs(2 * lightness - 1))
  return { h: normalizeHue(hue), s: clamp(saturation, 0, 1), l: lightness }
}

export function rgbToHwb(rgb) {
  const { h } = rgbToHsl(rgb)
  const whiteness = Math.min(rgb.r, rgb.g, rgb.b) / 255
  const blackness = 1 - Math.max(rgb.r, rgb.g, rgb.b) / 255
  return { h, w: whiteness, b: blackness }
}

// Accepts a hex string, an {r,g,b} triple, or an OKLCH color, and returns both
// representations so every unit reads from the same resolved value.
export function resolveColor(color) {
  if (typeof color === 'string') {
    const rgb = hexToRgb(color)
    if (!rgb) return null
    return { rgb, oklch: oklabToOklch(rgbToOklab(rgb)) }
  }
  if (!color || typeof color !== 'object') return null

  if (typeof color.L === 'number' && typeof color.C === 'number' && typeof color.H === 'number') {
    const inGamut = clampChroma(color)
    const raw = oklchToRgb(inGamut)
    return {
      rgb: { r: roundChannel(raw.r), g: roundChannel(raw.g), b: roundChannel(raw.b) },
      oklch: inGamut,
    }
  }

  if (typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
    const rgb = { r: roundChannel(color.r), g: roundChannel(color.g), b: roundChannel(color.b) }
    return { rgb, oklch: oklabToOklch(rgbToOklab(rgb)) }
  }

  if (typeof color.hex === 'string') return resolveColor(color.hex)
  return null
}

export function formatColor(color, unit = 'hex') {
  const resolved = resolveColor(color)
  if (!resolved) return ''
  const { rgb, oklch } = resolved

  switch (unit) {
    case 'rgb':
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
    case 'rgba':
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${OPAQUE_ALPHA})`
    case 'hsl': {
      const { h, s, l } = rgbToHsl(rgb)
      return `hsl(${Math.round(h)}deg, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
    }
    case 'hsla': {
      const { h, s, l } = rgbToHsl(rgb)
      return `hsla(${Math.round(h)}deg, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%, ${OPAQUE_ALPHA})`
    }
    case 'hwb': {
      const { h, w, b } = rgbToHwb(rgb)
      return `hwb(${Math.round(h)}deg ${Math.round(w * 100)}% ${Math.round(b * 100)}%)`
    }
    case 'oklch': {
      const hue = oklch.C < 1e-6 ? 0 : oklch.H
      return `oklch(${trimNumber(oklch.L, OKLCH_DECIMALS)} ${trimNumber(oklch.C, OKLCH_DECIMALS)} ${trimNumber(hue, HUE_DECIMALS)})`
    }
    case 'oklab': {
      const lab = oklchToOklab(oklch)
      return `oklab(${trimNumber(lab.L, OKLCH_DECIMALS)} ${trimNumber(lab.a, OKLCH_DECIMALS)} ${trimNumber(lab.b, OKLCH_DECIMALS)})`
    }
    case 'hex':
    default:
      return rgbToHex(rgb)
  }
}
