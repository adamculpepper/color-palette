// PNG, JPG and WebP all come from one canvas painted with the same geometry the
// SVG sheet uses, so the bitmap and the vector are the same picture at different
// resolutions. Nothing here touches the DOM until render() is called, which
// keeps the module importable in Node for the layout assertions.

import { sheetLayout } from './svg.js'

export const RASTER_SCALES = [1, 2, 3]

const DEFAULT_SCALE = 1
const MIN_SCALE = 0.05
const MAX_SCALE = 4
const OPAQUE_FALLBACK = '#ffffff'

const TEXT_ALIGN_BY_ANCHOR = { start: 'left', middle: 'center', end: 'right' }

export function normalizeScale(scale) {
  const value = Number(scale)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SCALE
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

// Pixel dimensions of the finished bitmap. Pure: the verification fixture uses
// it to prove the raster and the SVG agree on the sheet size.
export function rasterSize(palette, options = {}) {
  const layout = sheetLayout(palette, options)
  const scale = normalizeScale(options.scale)
  return {
    scale,
    sheetWidth: layout.width,
    sheetHeight: layout.height,
    width: Math.max(1, Math.round(layout.width * scale)),
    height: Math.max(1, Math.round(layout.height * scale)),
  }
}

function fillRoundedRect(context, cell) {
  if (typeof context.roundRect === 'function') {
    context.beginPath()
    context.roundRect(cell.x, cell.y, cell.width, cell.height, cell.radius)
    context.fill()
    return
  }
  context.fillRect(cell.x, cell.y, cell.width, cell.height)
}

function paintBackground(context, layout, opaque) {
  const { background } = layout
  const fill = background.fill || (opaque ? OPAQUE_FALLBACK : null)
  if (!fill) return

  context.fillStyle = fill
  context.fillRect(0, 0, layout.width, layout.height)
  if (!background.checker) return

  const size = background.squareSize
  context.fillStyle = background.checkerFill
  for (let y = 0; y < layout.height; y += size) {
    for (let x = 0; x < layout.width; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) context.fillRect(x, y, size, size)
    }
  }
}

function paintText(context, entry) {
  if (!entry.text || !entry.fontSize) return
  context.fillStyle = entry.ink
  context.font = `${entry.weight} ${entry.fontSize}px ${entry.font}`
  context.textAlign = TEXT_ALIGN_BY_ANCHOR[entry.anchor] || 'left'
  context.textBaseline = 'middle'
  context.fillText(entry.text, entry.x, entry.y)
}

export function renderRaster(palette, options = {}) {
  const layout = sheetLayout(palette, options)
  const scale = normalizeScale(options.scale)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(layout.width * scale))
  canvas.height = Math.max(1, Math.round(layout.height * scale))

  const context = canvas.getContext('2d')
  if (!context) return canvas
  context.scale(scale, scale)

  // JPEG has no alpha channel, so a format that declares itself opaque always
  // gets a painted background rather than the browser's default black.
  paintBackground(context, layout, Boolean(options.opaque))

  if (layout.title) paintText(context, layout.title)
  for (const header of layout.columnHeaders) paintText(context, header)
  for (const label of layout.rowLabels) paintText(context, label)

  for (const cell of layout.cells) {
    context.fillStyle = cell.fill
    fillRoundedRect(context, cell)
    paintText(context, {
      text: cell.label,
      x: cell.labelX,
      y: cell.labelY,
      fontSize: cell.labelSize,
      font: cell.labelFont,
      weight: 500,
      anchor: 'middle',
      ink: cell.labelInk,
    })
  }

  return canvas
}
