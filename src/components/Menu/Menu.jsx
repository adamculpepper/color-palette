import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Icon from '../Icon.jsx'
import './Menu.css'

// One popup menu for the whole app: the header overflow at narrow widths and the
// stage toolbar's collapsed palette actions both use it, so the keyboard
// contract is written once. Roving focus with the arrow keys, Home and End,
// Escape closes and hands focus back to the trigger, and a click anywhere else
// dismisses it without stealing focus.
//
// Items are plain data — { id, label, icon, onSelect, disabled } — so a caller
// never has to know how the popup is built.

const PREVIOUS_KEYS = ['ArrowUp', 'ArrowLeft']
const NEXT_KEYS = ['ArrowDown', 'ArrowRight']

export default function Menu({
  label,
  icon = 'ellipsis-vertical',
  items,
  align = 'end',
  showLabel = false,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)
  const listRef = useRef(null)
  const menuId = useId()

  const close = useCallback((returnFocus) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // Focus lands on the first item as the menu opens, which is what makes the
  // arrow keys mean something the moment it appears.
  useEffect(() => {
    if (!open) return undefined
    listRef.current?.querySelector('button:not([disabled])')?.focus()

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const handleListKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Tab') {
      close(false)
      return
    }

    const buttons = [...listRef.current.querySelectorAll('button:not([disabled])')]
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement)

    if (NEXT_KEYS.includes(event.key)) {
      event.preventDefault()
      buttons[(current + 1) % buttons.length].focus()
    } else if (PREVIOUS_KEYS.includes(event.key)) {
      event.preventDefault()
      buttons[(current - 1 + buttons.length) % buttons.length].focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      buttons[0].focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      buttons[buttons.length - 1].focus()
    }
  }

  const chooseItem = (item) => {
    close(true)
    item.onSelect()
  }

  return (
    <div className={className ? `app-menu ${className}` : 'app-menu'} ref={containerRef}>
      <button
        type="button"
        className={showLabel ? 'button menu-trigger' : 'button is-icon-only menu-trigger'}
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={showLabel ? undefined : label}
        title={label}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            close(true)
          }
        }}
      >
        <Icon name={icon} size={16} />
        {showLabel && <span>{label}</span>}
      </button>

      {open && (
        <div
          className="menu-popup"
          id={menuId}
          role="menu"
          aria-label={label}
          data-align={align}
          ref={listRef}
          onKeyDown={handleListKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={item.disabled}
              onClick={() => chooseItem(item)}
            >
              {item.icon && <Icon name={item.icon} size={14} className="menu-item-icon" />}
              <span className="menu-item-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
