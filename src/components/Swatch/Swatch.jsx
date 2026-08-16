import { DARK_INK, LIGHT_INK, contrastRatio, readableTextOn } from '../../lib/color/contrast.js'
import './Swatch.css'

const PREVIOUS_KEYS = ['ArrowLeft', 'ArrowUp']
const NEXT_KEYS = ['ArrowRight', 'ArrowDown']
const REMOVE_KEYS = ['Delete', 'Backspace']
const BADGE_DECIMALS = 1

// One base color of the palette: the pct 0 rung of its ladder. It is the only
// swatch that is focusable and draggable, because it is the only one that is
// editable — tints and shades are derived, so they copy rather than edit.
//
// Both arrow pairs move selection so the same keys work whether the grid is
// laid out in columns or in rows.
//
// labelMode and the contrast badge arrive from the same Display controls the
// ladder cells read, so the base row cannot end up labelled when the rest of the
// grid is bare — or unbadged when the rest of it is badged.
export default function Swatch({
  color,
  isSelected,
  isDropTarget,
  labelMode = 'value',
  showContrastBadge = false,
  onOpenEditor,
  onNavigate,
  onRemove,
  onDragStartColor,
  onDragEndColor,
  onDropColor,
}) {
  const ink = readableTextOn(color.hex)
  const label = labelMode === 'name' ? color.name : labelMode === 'value' ? color.value : null
  const bestContrast = Math.max(
    contrastRatio(LIGHT_INK, color.hex),
    contrastRatio(DARK_INK, color.hex),
  )

  const handleKeyDown = (event) => {
    if (PREVIOUS_KEYS.includes(event.key)) {
      event.preventDefault()
      onNavigate(color.index, -1)
      return
    }
    if (NEXT_KEYS.includes(event.key)) {
      event.preventDefault()
      onNavigate(color.index, 1)
      return
    }
    if (REMOVE_KEYS.includes(event.key)) {
      event.preventDefault()
      onRemove(color.index)
    }
  }

  const classNames = ['swatch']
  if (isSelected) classNames.push('is-selected')
  if (isDropTarget) classNames.push('is-drop-target')

  return (
    <div
      className={classNames.join(' ')}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        onDropColor(color.index)
      }}
    >
      <button
        type="button"
        className="swatch-block"
        data-swatch-index={color.index}
        draggable
        style={{ '--swatch-color': color.hex, '--swatch-ink': ink }}
        onClick={(event) => onOpenEditor(color.index, event.currentTarget)}
        onKeyDown={handleKeyDown}
        onDragStart={(event) => {
          // Firefox refuses to start a drag without payload on the transfer.
          event.dataTransfer.setData('text/plain', String(color.index))
          event.dataTransfer.effectAllowed = 'move'
          onDragStartColor(color.index)
        }}
        onDragEnd={onDragEndColor}
        aria-label={`Color ${color.index + 1}, ${color.name}, ${color.value}. Edit, or drag to reorder.`}
        title="Click to edit, drag to reorder"
      >
        {showContrastBadge && (
          <span className="contrast-badge">{bestContrast.toFixed(BADGE_DECIMALS)}</span>
        )}
        {label && (
          <span className="swatch-caption">
            <span className={labelMode === 'name' ? 'swatch-name' : 'swatch-value'}>{label}</span>
          </span>
        )}
      </button>
    </div>
  )
}
