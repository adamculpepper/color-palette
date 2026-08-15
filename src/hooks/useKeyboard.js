import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext.jsx'
import useQuickExport from './useQuickExport.js'

// App-wide shortcuts: R randomize, Ctrl/Cmd+Z undo, Ctrl+Y or Ctrl/Cmd+Shift+Z
// redo, E export, C copy the CSS.
//
// The grid owns its own arrow, Enter and Delete keys at the component level,
// where it knows what is selected, and they are deliberately not repeated here.

const SEED_RANGE = 2 ** 31
const ELEMENT_NODE = 1

// Only inputs that swallow letters count. A range, color, checkbox or radio
// input keeps focus after it is clicked, so treating every INPUT as typing left
// the whole app without shortcuts the moment anyone touched a slider — including
// Ctrl+Z, which is the one people reach for right after a drag goes wrong.
// SELECT stays on the list because native selects jump by first letter.
const TEXT_ENTRY_INPUT_TYPES = new Set([
  'text', 'number', 'search', 'email', 'url', 'password',
])

function isTextEntry(node) {
  if (!node || node.nodeType !== ELEMENT_NODE) return false
  if (node.isContentEditable) return true
  if (node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') return true
  if (node.tagName !== 'INPUT') return false
  // The DOM resolves a missing or unknown type attribute to "text" for us.
  return TEXT_ENTRY_INPUT_TYPES.has(String(node.type || 'text').toLowerCase())
}

function isInsideDialog(node) {
  return typeof node?.closest === 'function' && node.closest('[role="dialog"]') !== null
}

// Two questions, asked of both the event target and the focused element: is the
// user typing, and is a dialog holding focus? A single letter must never fire a
// shortcut while someone is naming a palette or working inside the export modal,
// and the modals run their own Escape and Tab handling.
function shortcutsBlocked(event) {
  const focused = document.activeElement
  return (
    isTextEntry(event.target) ||
    isTextEntry(focused) ||
    isInsideDialog(event.target) ||
    isInsideDialog(focused)
  )
}

function handleShortcut(event, handlers) {
  if (event.defaultPrevented || typeof event.key !== 'string') return
  if (shortcutsBlocked(event)) return

  const key = event.key.toLowerCase()

  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') {
      event.preventDefault()
      if (event.shiftKey) handlers.redo()
      else handlers.undo()
      return
    }
    if (key === 'y') {
      event.preventDefault()
      handlers.redo()
    }
    return
  }

  if (event.altKey || event.shiftKey) return

  switch (key) {
    case 'r':
      event.preventDefault()
      // Entropy is generated here, in the UI layer, and handed to the reducer as
      // a seed so the same roll can be reproduced and shared.
      handlers.randomize(Math.floor(Math.random() * SEED_RANGE))
      break
    case 'e':
      event.preventDefault()
      handlers.onExport()
      break
    case 'c':
      event.preventDefault()
      handlers.copyCss()
      break
    default:
      break
  }
}

export default function useKeyboard({ onExport }) {
  const { randomize, undo, redo } = useApp()
  // The same copy the stage footer button runs, so the shortcut and the click
  // can never produce different bytes.
  const { copyCss } = useQuickExport()

  // The listener binds once and reads the current handlers through a ref, so a
  // slider drag does not swap a window listener on every frame.
  const handlers = useRef(null)
  handlers.current = { randomize, undo, redo, onExport, copyCss }

  useEffect(() => {
    const onKeyDown = (event) => handleShortcut(event, handlers.current)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
