import { MAX_PALETTE_COLORS, useApp } from '../../context/AppContext.jsx'
import { PARAM_BY_KEY } from '../../data/params.js'
import useMediaQuery, { NARROW_LAYOUT } from '../../hooks/useMediaQuery.js'
import { distributeEvenly, reverseColors, sortByHue } from '../../lib/paletteOps.js'
import Icon from '../Icon.jsx'
import Menu from '../Menu/Menu.jsx'
import './StageToolbar.css'

const MIN_PALETTE_COLORS = 2
const MIN_DISTRIBUTABLE_COLORS = 3

export default function StageToolbar({ palette, onPasteColors }) {
  const {
    settings,
    selected,
    setParam,
    forkToCustom,
    backToGenerated,
    replaceColors,
    addColor,
    removeColor,
  } = useApp()
  const isNarrow = useMediaQuery(NARROW_LAYOUT)

  // Palette edits act on what the grid is showing, but they store what sits
  // UNDERNEATH it: sourceHex is the value before the Adjustments group ran, and
  // handing the displayed hex to a write would put the palette through its own
  // filters a second time on the next build.
  const baseHexes = palette.colors.map((color) => color.sourceHex)
  const isCustom = palette.source === 'custom'
  const colorCount = palette.colors.length
  const isFull = colorCount >= MAX_PALETTE_COLORS
  const countParam = PARAM_BY_KEY.count

  const stepCount = (delta) => {
    const next = settings.count + delta
    if (next < countParam.min || next > countParam.max) return
    setParam('count', next)
  }

  const applyOperation = (operation) => replaceColors(operation(baseHexes))

  // Selection survives a shrinking palette, so it is clamped before it is used.
  const removalIndex = selected === null ? colorCount - 1 : Math.min(selected, colorCount - 1)

  // The three reordering operations described once and rendered either as
  // buttons or as menu items, so the narrow layout can never fall behind.
  const reorderActions = [
    {
      id: 'sort',
      label: 'Sort by hue',
      icon: 'sort',
      title: 'Reorder the palette by hue',
      onSelect: () => applyOperation(sortByHue),
      disabled: colorCount < MIN_PALETTE_COLORS,
    },
    {
      id: 'reverse',
      label: 'Reverse',
      icon: 'reverse',
      title: 'Flip the palette end to end',
      onSelect: () => applyOperation(reverseColors),
      disabled: colorCount < MIN_PALETTE_COLORS,
    },
    {
      id: 'distribute',
      label: 'Distribute evenly',
      icon: 'distribute',
      title: 'Space the hues evenly between the first and last color',
      onSelect: () => applyOperation(distributeEvenly),
      disabled: colorCount < MIN_DISTRIBUTABLE_COLORS,
    },
  ]

  return (
    <div className="stage-toolbar">
      <div className="toolbar-line">
        <div className="source-switch" role="group" aria-label="Palette source">
          <button
            type="button"
            className={isCustom ? '' : 'is-selected'}
            aria-pressed={!isCustom}
            onClick={backToGenerated}
          >
            Generated
          </button>
          <button
            type="button"
            className={isCustom ? 'is-selected' : ''}
            aria-pressed={isCustom}
            onClick={() => forkToCustom(baseHexes)}
          >
            Custom
          </button>
        </div>

        <div className="count-stepper">
          <span className="stepper-label">Colors</span>
          <button
            type="button"
            className="stepper-button"
            onClick={() => stepCount(-1)}
            disabled={isCustom || settings.count <= countParam.min}
            title="One fewer color"
            aria-label="One fewer color"
          >
            <Icon name="minus" size={12} />
          </button>
          <span className="stepper-value">{colorCount}</span>
          <button
            type="button"
            className="stepper-button"
            onClick={() => stepCount(1)}
            disabled={isCustom || settings.count >= countParam.max}
            title="One more color"
            aria-label="One more color"
          >
            <Icon name="plus" size={12} />
          </button>
        </div>

        {/* In custom mode the count is whatever the color list holds, so swatches
            are added and removed one at a time instead of by the generator knob. */}
        {isCustom && (
          <div className="custom-actions">
            <button
              type="button"
              className="button"
              onClick={() => addColor(colorCount - 1, undefined, baseHexes)}
              disabled={isFull}
              title={
                isFull
                  ? `A palette holds at most ${MAX_PALETTE_COLORS} colors`
                  : 'Add a swatch to the end'
              }
            >
              <Icon name="plus" size={13} />
              <span className="button-label">Add swatch</span>
            </button>
            <button
              type="button"
              className="button"
              onClick={() => removeColor(removalIndex, baseHexes)}
              disabled={colorCount <= MIN_PALETTE_COLORS}
              title={
                colorCount <= MIN_PALETTE_COLORS
                  ? 'A palette keeps at least two colors'
                  : 'Remove the selected swatch'
              }
            >
              <Icon name="trash" size={13} />
              <span className="button-label">Remove swatch</span>
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-line palette-actions">
        <button type="button" className="button" onClick={onPasteColors} title="Paste your own colors">
          <Icon name="paste" size={13} />
          <span className="button-label">Paste colors</span>
        </button>

        {isNarrow ? (
          <Menu label="More" icon="ellipsis-vertical" items={reorderActions} align="end" showLabel />
        ) : (
          reorderActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="button"
              onClick={action.onSelect}
              disabled={action.disabled}
              title={action.title}
            >
              <Icon name={action.icon} size={13} />
              <span className="button-label">{action.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
