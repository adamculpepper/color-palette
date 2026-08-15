import Swatch from '../Swatch/Swatch.jsx'

// The pct 0 line of the grid in columns orientation: the rainbow itself, taller
// than its ladder rungs and always labelled. In rows orientation the base rung
// falls inside each color's own row instead, where PaletteGrid renders the same
// Swatch component directly — the swatch owns its behaviour, this only lays the
// row out.
export default function RainbowRow({ colors, showStepLabels, selected, dragIndex, swatchProps }) {
  return (
    <div className="grid-row is-base-row">
      {showStepLabels && <div className="step-label-cell is-base-label">Base</div>}

      {colors.map((color) => (
        <Swatch
          key={color.index}
          color={color}
          isSelected={selected === color.index}
          isDropTarget={dragIndex !== null && dragIndex !== color.index}
          {...swatchProps}
        />
      ))}
    </div>
  )
}
