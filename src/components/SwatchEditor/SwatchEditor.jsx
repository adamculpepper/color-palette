import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_PALETTE_COLORS, useApp } from '../../context/AppContext.jsx'
import { hexToOklch, maxChroma, oklchToHex } from '../../lib/color/oklch.js'
import { normalizeHex } from '../../lib/color/parse.js'
import { midpointHex } from '../../lib/paletteOps.js'
import Icon from '../Icon.jsx'
import './SwatchEditor.css'

const POPOVER_MARGIN = 8
const MIN_PALETTE_COLORS = 2
const CHROMA_STEP = 0.001
const LIGHTNESS_STEP = 0.005
const CHROMA_DECIMALS = 3
const FALLBACK_OKLCH = { L: 0.5, C: 0, H: 0 }

// The grid shows a color after the global adjustments have run; the editor has
// to write the value *underneath* them or every edit would re-base on its own
// filtered output and drift. While the palette is still generated there is no
// stored value yet, so the model's pre-adjustment sourceHex is the starting
// point — never the displayed hex, which already carries the filters.
function storedBaseHex(settings, index, paletteLength, sourceHex) {
  if (settings.paletteSource !== 'custom') return sourceHex
  if (settings.customColors.length !== paletteLength) return sourceHex
  const entry = settings.customColors[index]
  return normalizeHex(typeof entry === 'string' ? entry : entry?.hex) || sourceHex
}

export default function SwatchEditor({ palette, colorIndex, anchor, onClose }) {
  const { settings, setColor, addColor, removeColor, commit } = useApp()
  const popoverRef = useRef(null)
  const hexInputRef = useRef(null)
  const colorInputRef = useRef(null)
  const [placement, setPlacement] = useState(null)
  const [draftOklch, setDraftOklch] = useState(null)
  // The hex the channel sliders last wrote. Anything else arriving in baseHex
  // came from outside this draft and has to replace it.
  const draftHexRef = useRef(null)
  const [hexDraft, setHexDraft] = useState('')
  const [hexRejected, setHexRejected] = useState(false)

  const color = palette.colors[colorIndex]
  const displayedHex = color?.hex ?? ''
  const baseHex = storedBaseHex(settings, colorIndex, palette.colors.length, color?.sourceHex ?? '')
  // Every write stores pre-adjustment values, so the array handed to the reducer
  // is the source ramp, not the filtered one on screen.
  const baseHexes = palette.colors.map((entry) => entry.sourceHex)
  const canRemove = palette.colors.length > MIN_PALETTE_COLORS
  const isFull = palette.colors.length >= MAX_PALETTE_COLORS
  const fullTitle = `A palette holds at most ${MAX_PALETTE_COLORS} colors`

  // Anchored, not modal: the popover follows its swatch through scroll and
  // resize, and flips above when there is no room below.
  useLayoutEffect(() => {
    if (!anchor) return undefined

    const place = () => {
      const popover = popoverRef.current
      if (!popover) return
      const anchorBox = anchor.getBoundingClientRect()
      const { width, height } = popover.getBoundingClientRect()

      const rightEdge = Math.max(POPOVER_MARGIN, window.innerWidth - width - POPOVER_MARGIN)
      const centred = anchorBox.left + anchorBox.width / 2 - width / 2
      const left = Math.min(Math.max(POPOVER_MARGIN, centred), rightEdge)

      let top = anchorBox.bottom + POPOVER_MARGIN
      let flipped = false
      if (top + height > window.innerHeight - POPOVER_MARGIN) {
        const above = anchorBox.top - height - POPOVER_MARGIN
        if (above >= POPOVER_MARGIN) {
          top = above
          flipped = true
        } else {
          top = Math.max(POPOVER_MARGIN, window.innerHeight - height - POPOVER_MARGIN)
        }
      }
      setPlacement({ left, top, flipped })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (popoverRef.current?.contains(event.target)) return
      // The swatch owns the toggle, so a click on it must not close here first.
      if (anchor?.contains(event.target)) return
      onClose()
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchor, onClose])

  useEffect(() => {
    setHexDraft(baseHex)
    setHexRejected(false)
    // A value arriving from anywhere but the channel sliders — the hex field, the
    // native picker, an undo — is the new truth, so the draft steps aside. The
    // sliders' own writes come back here too, and those must NOT reset it: the
    // draft is what carries hue through a chroma of zero, where the hex has no
    // hue left to read back.
    if (baseHex !== draftHexRef.current) setDraftOklch(null)
  }, [baseHex])

  // A different swatch is a different color: the draft never crosses over.
  useEffect(() => {
    draftHexRef.current = null
    setDraftOklch(null)
  }, [colorIndex])

  useEffect(() => {
    hexInputRef.current?.select()
  }, [])

  // Closing hands focus back to the swatch, but only when it is still the
  // editor holding it — clicking straight onto another swatch must not have its
  // focus stolen back by the popover it just replaced.
  useEffect(() => {
    const popover = popoverRef.current
    return () => {
      if (popover?.contains(document.activeElement)) anchor?.focus()
    }
  }, [anchor])

  // The native picker reports every intermediate color as an input event and the
  // final one as a change event, which is exactly the live/commit split.
  useEffect(() => {
    const input = colorInputRef.current
    if (!input) return undefined
    const handleChange = () => commit()
    input.addEventListener('change', handleChange)
    return () => input.removeEventListener('change', handleChange)
  }, [commit])

  if (!color) return null

  const currentOklch = draftOklch ?? hexToOklch(baseHex) ?? FALLBACK_OKLCH
  const chromaCeiling = maxChroma(currentOklch.L, currentOklch.H)

  const applyHexDraft = () => {
    const normalized = normalizeHex(hexDraft)
    if (!normalized) {
      setHexRejected(true)
      setHexDraft(baseHex)
      return
    }
    setHexRejected(false)
    if (normalized === baseHex) return
    setColor(colorIndex, normalized, baseHexes)
    commit()
  }

  // One drag of a channel is one history entry: the moves are live, the pointer
  // release commits. The draft keeps hue alive while chroma passes through zero,
  // where a hex round-trip would lose it.
  const updateChannel = (channel, value) => {
    const next = { ...currentOklch, [channel]: value }
    const hex = oklchToHex(next)
    draftHexRef.current = hex
    setDraftOklch(next)
    setColor(colorIndex, hex, baseHexes)
  }

  // The gesture ends, the draft does not. Dropping it here is what made a slow
  // pass through chroma 0 permanent: the next drag would re-read hue from a gray
  // hex, where it is atan2 noise, and a blue came back olive.
  const endChannelGesture = () => {
    if (!draftOklch) return
    commit()
  }

  const duplicateColor = () => {
    addColor(colorIndex, baseHex, baseHexes)
    onClose()
  }

  const insertAfterColor = () => {
    const neighbour = palette.colors[colorIndex + 1]
    const neighbourHex = neighbour ? neighbour.sourceHex : baseHex
    addColor(colorIndex, midpointHex(baseHex, neighbourHex), baseHexes)
    onClose()
  }

  const removeThisColor = () => {
    removeColor(colorIndex, baseHexes)
    onClose()
  }

  return createPortal(
    <div
      ref={popoverRef}
      className={placement ? 'swatch-editor is-placed' : 'swatch-editor'}
      role="dialog"
      aria-label={`Edit color ${colorIndex + 1}, ${color.name}`}
      data-flipped={placement?.flipped ? 'true' : 'false'}
      style={{
        '--popover-x': `${placement?.left ?? 0}px`,
        '--popover-y': `${placement?.top ?? 0}px`,
      }}
    >
      <div className="editor-head">
        <span className="editor-preview" style={{ '--preview-color': displayedHex }} />
        <span className="editor-title">
          <span className="editor-name">{color.name}</span>
          <span className="editor-position">Color {colorIndex + 1}</span>
        </span>
        <button type="button" className="button is-icon-only" onClick={onClose} aria-label="Close editor">
          <Icon name="xmark" size={13} />
        </button>
      </div>

      <div className="editor-inputs">
        <input
          ref={hexInputRef}
          type="text"
          className={hexRejected ? 'editor-hex is-rejected' : 'editor-hex'}
          value={hexDraft}
          spellCheck="false"
          aria-label="Color value"
          aria-invalid={hexRejected}
          onChange={(event) => setHexDraft(event.target.value)}
          onBlur={applyHexDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') applyHexDraft()
          }}
        />
        <input
          ref={colorInputRef}
          type="color"
          value={baseHex}
          aria-label="Pick a color"
          onChange={(event) => setColor(colorIndex, event.target.value, baseHexes)}
        />
      </div>

      {displayedHex !== baseHex && (
        <p className="editor-note">Adjustments show it as {color.value}</p>
      )}

      <div className="editor-channels">
        <label className="editor-channel">
          <span className="channel-label">Lightness</span>
          <input
            type="range"
            min="0"
            max="1"
            step={LIGHTNESS_STEP}
            value={currentOklch.L}
            onChange={(event) => updateChannel('L', Number(event.target.value))}
            onPointerUp={endChannelGesture}
            onKeyUp={endChannelGesture}
            onBlur={endChannelGesture}
          />
          <span className="channel-value">{Math.round(currentOklch.L * 100)}%</span>
        </label>

        <label className="editor-channel">
          <span className="channel-label">Chroma</span>
          <input
            type="range"
            min="0"
            max={chromaCeiling}
            step={CHROMA_STEP}
            value={Math.min(currentOklch.C, chromaCeiling)}
            onChange={(event) => updateChannel('C', Number(event.target.value))}
            onPointerUp={endChannelGesture}
            onKeyUp={endChannelGesture}
            onBlur={endChannelGesture}
          />
          <span className="channel-value">{currentOklch.C.toFixed(CHROMA_DECIMALS)}</span>
        </label>

        <label className="editor-channel">
          <span className="channel-label">Hue</span>
          <input
            type="range"
            min="0"
            max="360"
            step="1"
            value={currentOklch.H}
            onChange={(event) => updateChannel('H', Number(event.target.value))}
            onPointerUp={endChannelGesture}
            onKeyUp={endChannelGesture}
            onBlur={endChannelGesture}
          />
          <span className="channel-value">{Math.round(currentOklch.H)}&deg;</span>
        </label>
      </div>

      <div className="editor-actions">
        <button
          type="button"
          className="button"
          onClick={duplicateColor}
          disabled={isFull}
          title={isFull ? fullTitle : 'Add a copy of this color'}
        >
          <Icon name="duplicate" size={12} />
          <span>Duplicate</span>
        </button>
        <button
          type="button"
          className="button"
          onClick={insertAfterColor}
          disabled={isFull}
          title={isFull ? fullTitle : 'Add the color halfway to the next one'}
        >
          <Icon name="plus" size={12} />
          <span>Insert after</span>
        </button>
        <button
          type="button"
          className="button is-destructive"
          onClick={removeThisColor}
          disabled={!canRemove}
          title={canRemove ? 'Remove this color' : 'A palette keeps at least two colors'}
        >
          <Icon name="trash" size={12} />
          <span>Remove</span>
        </button>
      </div>
    </div>,
    document.body,
  )
}
