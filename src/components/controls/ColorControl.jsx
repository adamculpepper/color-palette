const FULL_HEX = /^#[0-9a-f]{6}$/i
const SWATCH_FALLBACK = '#000000'

export default function ColorControl({ param, value, onChange, onCommit, disabled = false }) {
  const { label, help } = param
  // The native picker rejects anything but #rrggbb, so half-typed hex in the
  // text field must not reach it.
  const swatchValue = FULL_HEX.test(value) ? value : SWATCH_FALLBACK

  return (
    <div className={disabled ? 'control is-row is-disabled' : 'control is-row'} title={help || ''}>
      <span className="label">{label}</span>
      <div className="color-field">
        <input
          type="text"
          className="hex-field"
          value={value}
          spellCheck={false}
          disabled={disabled}
          aria-label={`${label} hex value`}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onCommit?.()}
        />
        <input
          type="color"
          value={swatchValue}
          disabled={disabled}
          aria-label={`${label} picker`}
          onInput={(event) => onChange(event.target.value)}
          onChange={() => onCommit?.()}
        />
      </div>
    </div>
  )
}
