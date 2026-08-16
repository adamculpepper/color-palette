// buildPalette is the single seam between the settings registry and the color
// engine: generate (or take) base colors, harmonize them, build every ladder,
// name everything, and hand back one PaletteModel. Exporters and the UI read
// that model and nothing else.
//
// This module also owns the unit conversion between registry values (percents,
// +/-100 dials) and engine values (0-1 fractions, OKLCH units). Nothing
// downstream of here deals in percents.

import { formatColor } from './color/format.js'
import { hexToOklch, oklchToHex } from './color/oklch.js'
import { normalizeHex } from './color/parse.js'
import { harmonize } from './harmonize.js'
import { dedupeNames, hueName, joinToken, sanitizeLabel, stepSuffix } from './naming.js'
import { generateRainbow } from './rainbow.js'
import { buildScale } from './scale.js'

export const DEFAULT_PALETTE_SETTINGS = {
  count: 7,
  harmony: 'spectrum',
  startHue: 29,
  hueSpread: 281,
  direction: 'cw',
  lightnessMode: 'natural',
  lightness: 72,
  chromaMode: 'vivid',
  saturation: 80,
  lightnessArc: 0,
  chromaArc: 0,
  hueEasing: 'linear',

  unify: 0,
  hueShift: 0,
  temperature: 0,
  satScale: 100,
  lightShift: 0,
  contrast: 0,
  preserveNeutrals: true,

  stepPercent: 10,
  stepCount: 4,
  pastelTints: 0,

  colorFormat: 'hex',
  namePrefix: 'color',
  nameStyle: 'hue',
  stepNaming: 'scale',

  paletteSource: 'generated',
  customColors: [],
}

// Registry ranges are wider than the engine's, so every dial gets an explicit
// divisor here rather than a magic number at the call site.
const LIGHTNESS_ARC_RANGE = 200
const CHROMA_ARC_RANGE = 100
const TEMPERATURE_RANGE = 100
const LIGHT_SHIFT_RANGE = 100
const CONTRAST_RANGE = 100
const PERCENT = 100

const FALLBACK_COLOR_NAME = 'color'

function readSettings(settings) {
  return { ...DEFAULT_PALETTE_SETTINGS, ...(settings || {}) }
}

function normalizeCustomColors(customColors) {
  if (!Array.isArray(customColors)) return []
  return customColors
    .map((entry) => {
      const source = typeof entry === 'string' ? { hex: entry } : entry || {}
      const hex = normalizeHex(source.hex)
      if (!hex) return null
      return { hex, label: source.label ? sanitizeLabel(source.label) : '' }
    })
    .filter(Boolean)
}

function colorNames(colors, { nameStyle, namePrefix, labels }) {
  const prefix = sanitizeLabel(namePrefix) || FALLBACK_COLOR_NAME
  const raw = colors.map((color, index) => {
    const label = labels[index]
    if (label) return label
    if (nameStyle === 'index') return `${prefix}-${index + 1}`
    return hueName(color.H, color.C)
  })
  return dedupeNames(raw)
}

export function buildPalette(settings) {
  const {
    count, harmony, startHue, hueSpread, direction,
    lightnessMode, lightness, chromaMode, saturation,
    lightnessArc, chromaArc, hueEasing,
    unify, hueShift, temperature, satScale, lightShift, contrast, preserveNeutrals,
    stepPercent, stepCount, pastelTints,
    colorFormat, namePrefix, nameStyle, stepNaming,
    paletteSource, customColors,
  } = readSettings(settings)

  const custom = normalizeCustomColors(customColors)
  // A custom source with nothing usable in it would leave the app with an empty
  // grid, so the generator takes over and the model says so.
  const source = paletteSource === 'custom' && custom.length ? 'custom' : 'generated'

  const baseColors = source === 'custom'
    ? custom.map((entry) => hexToOklch(entry.hex))
    : generateRainbow({
      count,
      harmony,
      startHue,
      hueSpread,
      direction,
      lightnessMode,
      lightness: lightness / PERCENT,
      chromaMode,
      chromaFactor: saturation / PERCENT,
      lightnessArc: lightnessArc / LIGHTNESS_ARC_RANGE,
      chromaArc: chromaArc / CHROMA_ARC_RANGE,
      hueEasing,
    })

  // The value UNDERNEATH the adjustments, one per color. Every UI path that
  // writes customColors has to hand back these, never the displayed hexes: a
  // displayed hex has already been through harmonize, so storing it would run
  // the adjustments a second time on the next build and the palette would drift
  // one hueShift further on every fork, sort or edit.
  const sourceHexes = source === 'custom'
    ? custom.map((entry) => entry.hex)
    : baseColors.map((color) => oklchToHex(color))

  const adjusted = harmonize(baseColors, {
    hueRotate: hueShift,
    hueConverge: unify / PERCENT,
    temperature: temperature / TEMPERATURE_RANGE,
    chromaScale: satScale / PERCENT,
    chromaConverge: unify / PERCENT,
    lightnessShift: lightShift / LIGHT_SHIFT_RANGE,
    lightnessSpread: contrast / CONTRAST_RANGE,
    preserveNeutrals,
  })

  const labels = source === 'custom' ? custom.map((entry) => entry.label) : adjusted.map(() => '')
  const names = colorNames(adjusted, { nameStyle, namePrefix, labels })
  const steps = Math.max(0, Math.round(stepCount))
  const maxStepPercent = steps * stepPercent

  const colors = adjusted.map((base, index) => {
    const name = names[index]
    const token = sanitizeLabel(name) || `${FALLBACK_COLOR_NAME}-${index + 1}`
    const ladder = buildScale(base, {
      stepPercent,
      stepCount: steps,
      chromaTaper: pastelTints / PERCENT,
    })

    return {
      index,
      hex: ladder.find((step) => step.isBase).hex,
      sourceHex: sourceHexes[index],
      name,
      token,
      value: formatColor(base, colorFormat),
      base: { L: base.L, C: base.C, H: base.H },
      steps: ladder.map((step) => ({
        pct: step.pct,
        hex: step.hex,
        token: joinToken(token, stepSuffix(step.pct, maxStepPercent, stepNaming)),
        value: formatColor({ L: step.L, C: step.C, H: step.H }, colorFormat),
        isBase: step.isBase,
        collapsed: step.collapsed,
        oklch: { L: step.L, C: step.C, H: step.H },
      })),
    }
  })

  return {
    source,
    colors,
    meta: {
      count: colors.length,
      stepPercent,
      stepCount: steps,
      maxStepPercent,
      colorFormat,
      nameStyle,
      stepNaming,
      namePrefix,
    },
  }
}
