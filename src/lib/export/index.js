// The export format registry. The modal iterates this list and branches on
// `kind` alone: text formats produce a string from build(), raster formats
// produce a canvas from render(). Adding a tenth format is an entry here and
// nothing else.
//
//   kind   'text' | 'raster'   how the output is produced
//   group  'code' | 'image'    which pill group it sits under, and whether the
//                              preview is source text or a picture
//   SVG is the one format that is both: text on disk, a picture on screen.

import { buildCss, buildLess, buildScss } from './code.js'
import { renderRaster } from './raster.js'
import { buildSvg } from './svg.js'
import { buildTailwind } from './tailwind.js'
import { buildTokens } from './tokens.js'

export const EXPORT_GROUPS = [
  { id: 'code', label: 'Code' },
  { id: 'image', label: 'Image' },
]

const SHEET_DEFAULTS = { layout: 'grid', showLabels: true, background: 'theme' }

// Quality is a percent in every place it is written down — the slider, the
// stored options, this default — and becomes the encoder's 0-1 fraction exactly
// once, at the download call site. Holding a fraction here instead would have
// the modal divide it by 100 a second time and encode a JPG at 0.0092.
export const QUALITY_RANGE = { min: 40, max: 100 }
export const RASTER_DEFAULTS = { ...SHEET_DEFAULTS, scale: 2, quality: 92 }

export const EXPORT_FORMATS = [
  {
    id: 'css',
    label: 'CSS',
    ext: 'css',
    mime: 'text/css',
    kind: 'text',
    group: 'code',
    build: buildCss,
  },
  {
    id: 'scss',
    label: 'SCSS',
    ext: 'scss',
    mime: 'text/x-scss',
    kind: 'text',
    group: 'code',
    build: buildScss,
  },
  {
    id: 'less',
    label: 'LESS',
    ext: 'less',
    mime: 'text/x-less',
    kind: 'text',
    group: 'code',
    build: buildLess,
  },
  {
    id: 'tailwind',
    label: 'Tailwind',
    ext: 'js',
    mime: 'text/javascript',
    kind: 'text',
    group: 'code',
    build: buildTailwind,
    defaults: { wrapModule: true },
    toggles: [{ key: 'wrapModule', label: 'Wrap in module.exports' }],
  },
  {
    id: 'json',
    label: 'JSON tokens',
    ext: 'json',
    mime: 'application/json',
    kind: 'text',
    group: 'code',
    build: buildTokens,
    defaults: { flat: false },
    toggles: [{ key: 'flat', label: 'Flat name and value map' }],
  },
  {
    id: 'svg',
    label: 'SVG',
    ext: 'svg',
    mime: 'image/svg+xml',
    kind: 'text',
    group: 'image',
    build: buildSvg,
    defaults: SHEET_DEFAULTS,
  },
  {
    id: 'png',
    label: 'PNG',
    ext: 'png',
    mime: 'image/png',
    kind: 'raster',
    group: 'image',
    render: renderRaster,
    defaults: RASTER_DEFAULTS,
  },
  {
    id: 'jpg',
    label: 'JPG',
    ext: 'jpg',
    mime: 'image/jpeg',
    kind: 'raster',
    group: 'image',
    render: renderRaster,
    defaults: RASTER_DEFAULTS,
    supportsQuality: true,
    opaque: true,
  },
  {
    id: 'webp',
    label: 'WebP',
    ext: 'webp',
    mime: 'image/webp',
    kind: 'raster',
    group: 'image',
    render: renderRaster,
    defaults: RASTER_DEFAULTS,
    supportsQuality: true,
  },
]

export const DEFAULT_FORMAT_ID = EXPORT_FORMATS[0].id

export function exportFormatById(id) {
  return EXPORT_FORMATS.find((format) => format.id === id) || EXPORT_FORMATS[0]
}

export function exportFormatsInGroup(groupId) {
  return EXPORT_FORMATS.filter((format) => format.group === groupId)
}

export function defaultFormatOptions(format) {
  return { ...(format.defaults || {}) }
}

export function clampQuality(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return RASTER_DEFAULTS.quality
  return Math.min(QUALITY_RANGE.max, Math.max(QUALITY_RANGE.min, numeric))
}

// Options restored from a previous session are merged over the current defaults
// and pulled back onto the ranges the controls allow. A quality of 0.92 left
// behind by the build that stored fractions clamps to the slider minimum rather
// than travelling on to the encoder as 0.0092.
export function mergeFormatOptions(format, saved) {
  const options = { ...defaultFormatOptions(format), ...(saved || {}) }
  if ('quality' in options) options.quality = clampQuality(options.quality)
  return options
}
