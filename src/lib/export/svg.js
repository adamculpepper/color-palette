// The swatch sheet. sheetLayout() computes every rectangle and every piece of
// text once; buildSvg() serializes that geometry to XML and raster.js paints the
// same geometry to a canvas, so the two exports can never drift apart.
//
// Sheet shape: rows are colors, columns are steps, with a label gutter on the
// left for color names and a header row on top for the step percentages.

import { readableTextOn } from '../color/contrast.js'
import { formatColor } from '../color/format.js'
import { normalizeHex } from '../color/parse.js'
import { exportUnit } from './code.js'

export const SHEET_METRICS = {
  cellWidth: 120,
  cellHeight: 96,
  gutter: 8,
  rowLabelWidth: 140,
  columnHeaderHeight: 28,
  padding: 24,
  titleHeight: 40,
  cellRadius: 8,
  checkerSquare: 12,
  labelGap: 12,
  titleFontSize: 20,
  headerFontSize: 12,
  rowLabelFontSize: 14,
  cellFontSize: 12,
  minCellFontSize: 8,
}

export const SHEET_LAYOUTS = ['grid', 'row']
export const SHEET_BACKGROUNDS = ['theme', 'white', 'black', 'checker']

const TEXT_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
const VALUE_FONT = "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace"
const MONO_ADVANCE_RATIO = 0.6
const FALLBACK_BACKGROUND = '#ffffff'
const BASE_STEP_LABEL = 'Base'

// Every attribute below is delimited with double quotes, so an apostrophe (the
// font stacks are full of them) needs no escape and reads better unescaped.
const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

function escapeXml(text) {
  return String(text).replace(/[&<>"]/g, (character) => XML_ESCAPES[character])
}

function stepColumnLabel(pct) {
  if (!pct) return BASE_STEP_LABEL
  return `${pct > 0 ? '+' : ''}${pct}%`
}

function baseStepOf(color) {
  return color.steps.find((step) => step.isBase) || color.steps[0]
}

// Values run long in rgba() and oklab(), so the cell label shrinks to fit rather
// than spilling over the swatch edge.
function fittedFontSize(text, maxWidth) {
  const width = Math.floor(maxWidth / Math.max(1, text.length * MONO_ADVANCE_RATIO))
  return Math.max(SHEET_METRICS.minCellFontSize, Math.min(SHEET_METRICS.cellFontSize, width))
}

export function resolveSheetBackground(options = {}) {
  const {
    background = 'theme',
    themeColor,
    checkerBase,
    checkerSquare,
  } = options

  if (background === 'white') return { fill: '#ffffff', checker: false }
  if (background === 'black') return { fill: '#000000', checker: false }
  if (background === 'checker') {
    return {
      fill: normalizeHex(checkerBase) || FALLBACK_BACKGROUND,
      checker: true,
      checkerFill: normalizeHex(checkerSquare) || '#cccccc',
      squareSize: SHEET_METRICS.checkerSquare,
    }
  }
  return { fill: normalizeHex(themeColor) || FALLBACK_BACKGROUND, checker: false }
}

// Rows and columns, before any pixel math. Grid puts every step on screen; row
// keeps the base colors only, laid out as the rainbow strip.
export function sheetMatrix(palette, options = {}) {
  const { layout = 'grid' } = options
  const unit = exportUnit(palette, options)
  const colors = palette?.colors ?? []
  if (colors.length === 0) return { columnLabels: [], rows: [] }

  if (layout === 'row') {
    return {
      columnLabels: colors.map((color) => color.name),
      showRowLabels: false,
      rows: [{
        label: '',
        cells: colors.map((color) => {
          const step = baseStepOf(color)
          return { hex: step.hex, value: formatColor(step.oklch, unit) }
        }),
      }],
    }
  }

  return {
    columnLabels: colors[0].steps.map((step) => stepColumnLabel(step.pct)),
    showRowLabels: true,
    rows: colors.map((color) => ({
      label: color.name,
      cells: color.steps.map((step) => ({ hex: step.hex, value: formatColor(step.oklch, unit) })),
    })),
  }
}

export function sheetLayout(palette, options = {}) {
  const { showLabels = true, title = '' } = options
  const metrics = SHEET_METRICS
  const matrix = sheetMatrix(palette, options)
  const background = resolveSheetBackground(options)
  const ink = readableTextOn(background.fill)

  const columnCount = matrix.columnLabels.length
  const rowCount = matrix.rows.length
  const rowLabelWidth = showLabels && matrix.showRowLabels ? metrics.rowLabelWidth : 0
  const headerHeight = showLabels && columnCount > 0 ? metrics.columnHeaderHeight : 0
  const titleHeight = title ? metrics.titleHeight : 0

  const gridWidth = columnCount > 0
    ? columnCount * metrics.cellWidth + (columnCount - 1) * metrics.gutter
    : 0
  const gridHeight = rowCount > 0
    ? rowCount * metrics.cellHeight + (rowCount - 1) * metrics.gutter
    : 0

  const width = metrics.padding * 2 + rowLabelWidth + gridWidth
  const height = metrics.padding * 2 + titleHeight + headerHeight + gridHeight
  const gridLeft = metrics.padding + rowLabelWidth
  const gridTop = metrics.padding + titleHeight + headerHeight

  const columnX = (column) => gridLeft + column * (metrics.cellWidth + metrics.gutter)
  const rowY = (row) => gridTop + row * (metrics.cellHeight + metrics.gutter)

  const titleEntry = title
    ? {
      text: title,
      x: metrics.padding,
      y: metrics.padding + metrics.titleFontSize / 2,
      fontSize: metrics.titleFontSize,
      font: TEXT_FONT,
      weight: 700,
      anchor: 'start',
      ink,
    }
    : null

  const columnHeaders = showLabels
    ? matrix.columnLabels.map((text, column) => ({
      text,
      x: columnX(column) + metrics.cellWidth / 2,
      y: metrics.padding + titleHeight + headerHeight / 2,
      fontSize: metrics.headerFontSize,
      font: TEXT_FONT,
      weight: 600,
      anchor: 'middle',
      ink,
    }))
    : []

  const rowLabels = rowLabelWidth
    ? matrix.rows.map((row, index) => ({
      text: row.label,
      x: gridLeft - metrics.labelGap,
      y: rowY(index) + metrics.cellHeight / 2,
      fontSize: metrics.rowLabelFontSize,
      font: TEXT_FONT,
      weight: 600,
      anchor: 'end',
      ink,
    }))
    : []

  const cells = []
  matrix.rows.forEach((row, rowIndex) => {
    row.cells.forEach((cell, columnIndex) => {
      const x = columnX(columnIndex)
      const y = rowY(rowIndex)
      const label = showLabels ? cell.value : ''
      cells.push({
        x,
        y,
        width: metrics.cellWidth,
        height: metrics.cellHeight,
        radius: metrics.cellRadius,
        fill: cell.hex,
        label,
        labelX: x + metrics.cellWidth / 2,
        labelY: y + metrics.cellHeight / 2,
        labelInk: readableTextOn(cell.hex),
        labelSize: label ? fittedFontSize(label, metrics.cellWidth - metrics.labelGap * 2) : 0,
        labelFont: VALUE_FONT,
      })
    })
  })

  return { width, height, background, ink, title: titleEntry, columnHeaders, rowLabels, cells, metrics }
}

function textElement(entry) {
  return (
    `<text x="${entry.x}" y="${entry.y}" fill="${entry.ink}" font-family="${escapeXml(entry.font)}" ` +
    `font-size="${entry.fontSize}" font-weight="${entry.weight}" text-anchor="${entry.anchor}" ` +
    `dominant-baseline="central">${escapeXml(entry.text)}</text>`
  )
}

export function buildSvg(palette, options = {}) {
  const layout = sheetLayout(palette, options)
  const { background } = layout
  const parts = []

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" ` +
    `viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Color palette swatch sheet">`,
  )

  if (background.checker) {
    const size = background.squareSize * 2
    parts.push(
      '<defs>',
      `<pattern id="sheet-checker" width="${size}" height="${size}" patternUnits="userSpaceOnUse">`,
      `<rect width="${size}" height="${size}" fill="${background.fill}"/>`,
      `<rect width="${background.squareSize}" height="${background.squareSize}" fill="${background.checkerFill}"/>`,
      `<rect x="${background.squareSize}" y="${background.squareSize}" width="${background.squareSize}" ` +
      `height="${background.squareSize}" fill="${background.checkerFill}"/>`,
      '</pattern>',
      '</defs>',
      `<rect width="${layout.width}" height="${layout.height}" fill="url(#sheet-checker)"/>`,
    )
  } else {
    parts.push(`<rect width="${layout.width}" height="${layout.height}" fill="${background.fill}"/>`)
  }

  if (layout.title) parts.push(textElement(layout.title))
  for (const header of layout.columnHeaders) parts.push(textElement(header))
  for (const label of layout.rowLabels) parts.push(textElement(label))

  for (const cell of layout.cells) {
    parts.push(
      `<rect x="${cell.x}" y="${cell.y}" width="${cell.width}" height="${cell.height}" ` +
      `rx="${cell.radius}" fill="${cell.fill}"/>`,
    )
    if (!cell.label) continue
    parts.push(textElement({
      text: cell.label,
      x: cell.labelX,
      y: cell.labelY,
      fontSize: cell.labelSize,
      font: cell.labelFont,
      weight: 500,
      anchor: 'middle',
      ink: cell.labelInk,
    }))
  }

  parts.push('</svg>')
  return `${parts.join('')}\n`
}
