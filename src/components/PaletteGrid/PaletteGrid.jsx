import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import useMediaQuery, { COMPACT_LABELS, NO_CELL_LABELS } from '../../hooks/useMediaQuery.js'
import Swatch from '../Swatch/Swatch.jsx'
import SwatchEditor from '../SwatchEditor/SwatchEditor.jsx'
import { useToast } from '../Toast/Toast.jsx'
import RainbowRow from './RainbowRow.jsx'
import StepCell from './StepCell.jsx'
import './PaletteGrid.css'

const LABEL_COLUMN = 'var(--label-size)'

function stepPercentText(percent) {
  return `${percent > 0 ? '+' : '-'}${Math.abs(percent)}%`
}

// The gutter says which way the ladder runs: every tint row reads "lighter"
// and every shade row "darker", so no row needs the reader to decode the sign.
function StepLabel({ percent }) {
  if (percent === 0) return 'Base'
  const direction = percent > 0 ? 'lighter' : 'darker'
  return (
    <span className="step-label" title={`${Math.abs(percent)}% ${direction} than the base`}>
      <span className="step-percent">{stepPercentText(percent)}</span>
      <span className="step-direction">{direction}</span>
    </span>
  )
}

// The template is built here rather than in CSS because repeat() needs a literal
// count, and in rows orientation the base column is wider than its neighbours.
function columnTemplate({ orientation, colorCount, ladder, showStepLabels }) {
  if (orientation === 'rows') {
    const stepColumns = ladder.map((step) => (step.isBase ? 'var(--swatch-size)' : 'var(--step-size)'))
    return [LABEL_COLUMN, ...stepColumns].join(' ')
  }
  const colorColumns = `repeat(${colorCount}, var(--swatch-size))`
  return showStepLabels ? `${LABEL_COLUMN} ${colorColumns}` : colorColumns
}

// A cell narrow enough to clip a token name still has room for a hex value, and
// below that it has room for neither. Degrading the content rather than letting
// it ellipsize keeps every label that IS drawn fully readable.
function labelModeForWidth(requested, compact, tiny) {
  if (tiny) return 'none'
  if (compact && requested === 'name') return 'value'
  return requested
}

export default function PaletteGrid({ palette }) {
  const { settings, selected, setSelected, moveColor, removeColor } = useApp()
  const showToast = useToast()
  const gridRef = useRef(null)
  const [editor, setEditor] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const isCompact = useMediaQuery(COMPACT_LABELS)
  const isTiny = useMediaQuery(NO_CELL_LABELS)

  const { swatchShape, swatchSize, showStepLabels, gridOrientation, contrastBadges } = settings
  const labelMode = labelModeForWidth(settings.labelMode, isCompact, isTiny)
  const colors = palette.colors
  // Every color carries the same ladder shape, so the first one drives the rows.
  const ladder = colors[0]?.steps ?? []
  // Pre-adjustment values: a reorder or a removal rewrites the stored palette,
  // and storing displayed hexes would bake the Adjustments group into it and
  // then run those same filters over the result again.
  const baseHexes = useMemo(() => colors.map((color) => color.sourceHex), [colors])

  // A removed color must not leave the popover anchored to a swatch that is gone.
  useEffect(() => {
    if (editor && editor.index >= colors.length) {
      setEditor(null)
      setSelected(null)
    }
  }, [editor, colors.length, setSelected])

  const copyValue = useCallback(
    async (value) => {
      try {
        await navigator.clipboard.writeText(value)
        showToast(`Copied ${value}`)
      } catch {
        showToast('Copying needs clipboard permission')
      }
    },
    [showToast],
  )

  // Selection mirrors the editor: it appears when a swatch's editor opens and
  // clears when it closes, so no accent ring lingers after a deselect.
  const openEditor = useCallback(
    (index, anchor) => {
      const closing = editor !== null && editor.index === index
      setSelected(closing ? null : index)
      setEditor(closing ? null : { index, anchor })
    },
    [editor, setSelected],
  )

  const closeEditor = useCallback(() => {
    setEditor(null)
    setSelected(null)
  }, [setSelected])

  const moveSelection = useCallback(
    (fromIndex, delta) => {
      const nextIndex = fromIndex + delta
      if (nextIndex < 0 || nextIndex >= colors.length) return
      setSelected(nextIndex)
      gridRef.current?.querySelector(`[data-swatch-index="${nextIndex}"]`)?.focus()
    },
    [colors.length, setSelected],
  )

  const removeAtIndex = useCallback(
    (index) => {
      removeColor(index, baseHexes)
      closeEditor()
    },
    [baseHexes, closeEditor, removeColor],
  )

  const dropOnIndex = useCallback(
    (toIndex) => {
      if (dragIndex !== null && dragIndex !== toIndex) moveColor(dragIndex, toIndex, baseHexes)
      setDragIndex(null)
    },
    [baseHexes, dragIndex, moveColor],
  )

  // The base row answers to the same Display controls as the ladder cells: one
  // "Swatch labels" setting, one contrast-badge toggle, no row exempt.
  const swatchProps = useMemo(
    () => ({
      labelMode,
      showContrastBadge: contrastBadges,
      onOpenEditor: openEditor,
      onNavigate: moveSelection,
      onRemove: removeAtIndex,
      onDragStartColor: setDragIndex,
      onDragEndColor: () => setDragIndex(null),
      onDropColor: dropOnIndex,
    }),
    [contrastBadges, dropOnIndex, labelMode, moveSelection, openEditor, removeAtIndex],
  )

  if (colors.length === 0) {
    return <p className="palette-empty">No colors to show. Paste a palette or switch back to generated.</p>
  }

  // The accent ring means "this swatch's editor is open", so it can never
  // outlive the popover no matter which path moved the selection.
  const highlightedIndex = editor !== null ? selected : null

  const orientation = gridOrientation === 'rows' ? 'rows' : 'columns'
  const gridColumns = columnTemplate({
    orientation,
    colorCount: colors.length,
    ladder,
    showStepLabels,
  })

  return (
    <>
      <div
        className="palette-grid"
        ref={gridRef}
        data-orientation={orientation}
        data-shape={swatchShape}
        // The size the Display group asked for. CSS derives the size actually
        // used from it, so a narrow viewport can cap it without the slider and
        // the layout disagreeing about who owns the value.
        style={{ '--swatch-size-setting': `${swatchSize}px`, '--grid-columns': gridColumns }}
      >
        {orientation === 'columns'
          ? ladder.map((templateStep, rowIndex) =>
              templateStep.isBase ? (
                <RainbowRow
                  key={rowIndex}
                  colors={colors}
                  showStepLabels={showStepLabels}
                  selected={highlightedIndex}
                  dragIndex={dragIndex}
                  swatchProps={swatchProps}
                />
              ) : (
                <div className="grid-row" key={rowIndex}>
                  {showStepLabels && (
                    <div className="step-label-cell">
                      <StepLabel percent={templateStep.pct} />
                    </div>
                  )}
                  {colors.map((color) => (
                    <StepCell
                      key={color.index}
                      color={color}
                      step={color.steps[rowIndex]}
                      labelMode={labelMode}
                      showContrastBadge={contrastBadges}
                      onCopy={copyValue}
                    />
                  ))}
                </div>
              ),
            )
          : (
            <>
              {showStepLabels && (
                <div className="grid-row is-header-row">
                  <div className="corner-cell" />
                  {ladder.map((templateStep, columnIndex) => (
                    <div className="step-label-cell is-column-label" key={columnIndex}>
                      <StepLabel percent={templateStep.pct} />
                    </div>
                  ))}
                </div>
              )}

              {colors.map((color) => (
                <div className="grid-row is-color-row" key={color.index}>
                  <div className="color-label-cell">{color.name}</div>
                  {color.steps.map((step, columnIndex) =>
                    step.isBase ? (
                      <Swatch
                        key={columnIndex}
                        color={color}
                        isSelected={highlightedIndex === color.index}
                        isDropTarget={dragIndex !== null && dragIndex !== color.index}
                        {...swatchProps}
                      />
                    ) : (
                      <StepCell
                        key={columnIndex}
                        color={color}
                        step={step}
                        labelMode={labelMode}
                        showContrastBadge={contrastBadges}
                        onCopy={copyValue}
                      />
                    ),
                  )}
                </div>
              ))}
            </>
          )}
      </div>

      {editor && (
        <SwatchEditor
          palette={palette}
          colorIndex={editor.index}
          anchor={editor.anchor}
          onClose={closeEditor}
        />
      )}
    </>
  )
}
