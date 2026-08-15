// WCAG contrast, used for swatch label ink and the optional contrast badges.

import { hexToRgb, srgbChannelToLinear } from './oklch.js'

export const DARK_INK = '#111111'
export const LIGHT_INK = '#ffffff'

// WCAG 2.x relative luminance: linear-light channels, luminosity weights.
export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const red = srgbChannelToLinear(rgb.r / 255)
  const green = srgbChannelToLinear(rgb.g / 255)
  const blue = srgbChannelToLinear(rgb.b / 255)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}

export function readableTextOn(background) {
  return contrastRatio(DARK_INK, background) >= contrastRatio(LIGHT_INK, background) ? DARK_INK : LIGHT_INK
}
