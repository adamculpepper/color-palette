import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_PALETTE_COLORS, useApp } from '../../context/AppContext.jsx'
import useFocusTrap from '../../hooks/useFocusTrap.js'
import { parseColorList } from '../../lib/color/parse.js'
import Icon from '../Icon.jsx'
import { useToast } from '../Toast/Toast.jsx'
import './PaletteImport.css'

const PLACEHOLDER = '#ff0000 #00ff00, 0000ff\nrgb(60, 90, 200)'
const MAX_PREVIEW_CHIPS = 48
const MAX_LISTED_REJECTIONS = 6
const MIN_USEFUL_COLORS = 2

// Paste anything: hex with or without the hash, rgb() notation, commas,
// newlines, CSS lines lifted from a stylesheet. Whatever the parser cannot read
// is reported by line instead of failing the whole paste.
export default function PaletteImport({ onClose }) {
  const { replaceColors } = useApp()
  const showToast = useToast()
  const [text, setText] = useState('')
  const dialogRef = useRef(null)
  const textareaRef = useRef(null)

  const { colors, rejected } = useMemo(() => parseColorList(text), [text])

  // Focus opens on the textarea rather than the close button, because pasting is
  // the entire reason this dialog exists.
  useFocusTrap({ containerRef: dialogRef, onClose, initialFocusRef: textareaRef })

  // The palette has a hard ceiling, so an oversized paste is trimmed here and
  // said out loud twice: in the dialog before the import runs, and in the toast
  // after it. Silently keeping 24 and dropping the rest is how a paste looks
  // accepted until the page is reloaded.
  const kept = colors.slice(0, MAX_PALETTE_COLORS)
  const droppedCount = colors.length - kept.length

  const importColors = () => {
    if (kept.length === 0) return
    replaceColors(kept)
    showToast(
      droppedCount > 0
        ? `${colors.length} colors read, first ${MAX_PALETTE_COLORS} kept`
        : `Imported ${kept.length} ${kept.length === 1 ? 'color' : 'colors'}`,
    )
    onClose()
  }

  const shownChips = kept.slice(0, MAX_PREVIEW_CHIPS)
  const hiddenChipCount = kept.length - shownChips.length
  const listedRejections = rejected.slice(0, MAX_LISTED_REJECTIONS)
  const hiddenRejectionCount = rejected.length - listedRejections.length

  return createPortal(
    <div
      className="import-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="palette-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="import-head">
          <h2 className="import-title" id="import-title">
            Paste colors
          </h2>
          <button type="button" className="button is-icon-only" onClick={onClose} aria-label="Close">
            <Icon name="xmark" size={13} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          className="import-input"
          rows={5}
          spellCheck="false"
          placeholder={PLACEHOLDER}
          aria-label="Colors to import"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />

        <p className="import-help">
          Hex, rgb() or a whole CSS line. A code written without the # needs six or eight
          characters and at least one digit, so all-letter codes like ffeeaa need the #.
        </p>

        <div className="import-readout">
          <span className="readout-count">
            {colors.length} {colors.length === 1 ? 'color read' : 'colors read'}
          </span>
          {colors.length > 0 && colors.length < MIN_USEFUL_COLORS && (
            <span className="readout-hint">A palette wants at least two.</span>
          )}
          {droppedCount > 0 && (
            <span className="readout-hint is-capped">
              First {MAX_PALETTE_COLORS} kept. A palette holds at most {MAX_PALETTE_COLORS}.
            </span>
          )}
        </div>

        {kept.length > 0 && (
          <ul className="import-preview">
            {shownChips.map((hex, index) => (
              <li
                key={`${hex}-${index}`}
                className="preview-chip"
                style={{ '--chip-color': hex }}
                title={hex}
              />
            ))}
            {hiddenChipCount > 0 && <li className="preview-more">+{hiddenChipCount}</li>}
          </ul>
        )}

        {rejected.length > 0 && (
          <ul className="import-rejections">
            {listedRejections.map((rejection, index) => (
              <li key={`${rejection.line}-${rejection.token}-${index}`}>
                Line {rejection.line}: could not read <code>{rejection.token}</code>
              </li>
            ))}
            {hiddenRejectionCount > 0 && <li>and {hiddenRejectionCount} more</li>}
          </ul>
        )}

        <div className="import-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button is-primary"
            onClick={importColors}
            disabled={kept.length === 0}
          >
            <Icon name="check" size={12} />
            <span>Import {kept.length > 0 ? kept.length : ''}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
