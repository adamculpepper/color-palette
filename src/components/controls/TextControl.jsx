import { useId } from 'react'

// Live on every keystroke, committed on blur or Enter, so typing a prefix is
// one undo entry rather than one per character.
export default function TextControl({ param, value, onChange, onCommit, disabled = false }) {
  const { label, help, placeholder, maxLength } = param
  const inputId = useId()

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onCommit?.()
    }
  }

  return (
    <div className={disabled ? 'control is-disabled' : 'control'} title={help || ''}>
      <div className="head">
        <label className="label" htmlFor={inputId}>
          {label}
        </label>
      </div>
      <input
        id={inputId}
        type="text"
        className="text-field"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        spellCheck={false}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onCommit?.()}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
