import { useEffect, useRef } from 'react'

// The dialog contract, written once: focus moves in when the dialog opens, Tab
// cycles inside it, Escape closes it, and focus returns to whatever had it
// before. The export modal, the paste modal and the controls drawer all run
// through here so none of them can drift from the others.
//
// `onClose` is held in a ref rather than listed as a dependency. Callers pass an
// inline arrow function, and re-running this effect on every parent render would
// restore focus mid-session — the caret would jump out of the dialog the moment
// a slider inside it moved.

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export default function useFocusTrap({ containerRef, onClose, initialFocusRef, active = true }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!active) return undefined
    const container = containerRef.current
    if (!container) return undefined

    const previouslyFocused = document.activeElement
    const focusableItems = () => [...container.querySelectorAll(FOCUSABLE_SELECTOR)]
    const target = initialFocusRef?.current || focusableItems()[0] || container
    target.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        // Stops here so an outer dialog or a global shortcut never also reacts.
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusableItems()
      if (items.length === 0) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [active, containerRef, initialFocusRef])
}
