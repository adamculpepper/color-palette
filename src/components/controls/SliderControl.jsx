import { useEffect, useId, useState } from 'react'

// Range plus a typeable number field. onChange fires live during a drag;
// onCommit fires on release or blur so undo records one entry per gesture.
export default function SliderControl({ param, value, onChange, onCommit, disabled = false }) {
  const { label, min, max, step, unit, help } = param
  const rangeId = useId()
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  // While the number field has focus, partial typing wins. Every other source
  // of change (undo, reset, randomize) syncs the display.
  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  function handleRange(event) {
    const next = parseFloat(event.target.value)
    setText(String(next))
    onChange(next)
  }

  function handleNumber(event) {
    setText(event.target.value)
    const next = parseFloat(event.target.value)
    if (!Number.isNaN(next) && next >= min && next <= max) onChange(next)
  }

  function handleNumberBlur() {
    setFocused(false)
    const typed = parseFloat(text)
    if (Number.isNaN(typed) || typed < min || typed > max) setText(String(value))
    onCommit?.()
  }

  return (
    <div className={disabled ? 'control is-disabled' : 'control'} title={help || ''}>
      <div className="head">
        <label className="label" htmlFor={rangeId}>
          {label}
        </label>
        <div className={unit ? 'value-field has-unit' : 'value-field'}>
          <input
            type="number"
            value={text}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            aria-label={`${label} value`}
            onChange={handleNumber}
            onFocus={() => setFocused(true)}
            onBlur={handleNumberBlur}
          />
          {unit && <span className="unit">{unit}</span>}
        </div>
      </div>
      <input
        id={rangeId}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={handleRange}
        onPointerUp={() => onCommit?.()}
        onKeyUp={() => onCommit?.()}
      />
    </div>
  )
}
