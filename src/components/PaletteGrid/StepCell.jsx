import { DARK_INK, LIGHT_INK, contrastRatio, readableTextOn } from '../../lib/color/contrast.js'
import Icon from '../Icon.jsx'

const BADGE_DECIMALS = 1

function stepDescription(percent) {
  return `${Math.abs(percent)}% ${percent > 0 ? 'lighter' : 'darker'}`
}

// One tint or shade cell. Clicking it copies the value in whatever unit the
// palette is currently speaking, which is the same string the code exports emit.
export default function StepCell({ color, step, labelMode, showContrastBadge, onCopy }) {
  const ink = readableTextOn(step.hex)
  const label = labelMode === 'name' ? step.token : step.value
  const description = stepDescription(step.pct)
  const bestContrast = Math.max(
    contrastRatio(LIGHT_INK, step.hex),
    contrastRatio(DARK_INK, step.hex),
  )

  return (
    <button
      type="button"
      className={step.collapsed ? 'step-cell is-collapsed' : 'step-cell'}
      style={{ '--cell-color': step.hex, '--cell-ink': ink }}
      onClick={() => onCopy(step.value)}
      aria-label={`Color ${color.index + 1}, ${color.name}, ${step.value}, ${description}`}
      title={
        step.collapsed
          ? `${step.value} — same as the neighbouring step, the ladder has reached the end of its range`
          : step.value
      }
    >
      {labelMode !== 'none' && <span className="cell-label">{label}</span>}

      {showContrastBadge && (
        <span className="contrast-badge">{bestContrast.toFixed(BADGE_DECIMALS)}</span>
      )}

      {/* Hover affordance: this cell copies. Hidden until hover/focus in CSS. */}
      <Icon name="duplicate" size={10} className="copy-hint" />

      {step.collapsed && <Icon name="equals" size={9} className="collapsed-marker" />}
    </button>
  )
}
