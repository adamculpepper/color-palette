import { useState } from 'react'
import Icon from '../Icon.jsx'
import './ControlSection.css'

// Collapsible group. Controlled when `open` and `onToggle` are supplied (the
// sidebar persists that map); otherwise it manages itself from `defaultOpen`.
export default function ControlSection({ title, open: openProp, onToggle, defaultOpen = true, children }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const handleToggle = isControlled ? onToggle : () => setInternalOpen((current) => !current)

  return (
    <section className="control-section">
      <button type="button" className="section-header" aria-expanded={open} onClick={handleToggle}>
        <span className="section-title">{title}</span>
        {/* The chevron's open state is read straight off aria-expanded in CSS,
            so the button's accessible state and its look cannot disagree. */}
        <Icon name="chevron-down" size={14} className="section-chevron" />
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  )
}
