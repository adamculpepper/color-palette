export default function ToggleControl({ param, value, onChange, disabled = false }) {
  const { label, help } = param

  return (
    <div className={disabled ? 'control is-row is-disabled' : 'control is-row'} title={help || ''}>
      <span className="label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        className={value ? 'toggle-switch is-on' : 'toggle-switch'}
        onClick={() => onChange(!value)}
      >
        <span className="knob" />
      </button>
    </div>
  )
}
