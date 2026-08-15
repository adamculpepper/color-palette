import { useId } from 'react'

export default function SelectControl({ param, value, onChange, disabled = false }) {
  const { label, options, help } = param
  const selectId = useId()

  return (
    <div className={disabled ? 'control is-disabled' : 'control'} title={help || ''}>
      <div className="head">
        <label className="label" htmlFor={selectId}>
          {label}
        </label>
      </div>
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
