// Pill group for short option sets where seeing all the choices beats a select.
export default function SegmentedControl({ param, value, onChange, disabled = false }) {
  const { label, options, help } = param

  return (
    <div className={disabled ? 'control is-disabled' : 'control'} title={help || ''}>
      <div className="head">
        <span className="label">{label}</span>
      </div>
      <div className="segmented-control" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              className={selected ? 'is-selected' : ''}
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
