import { cloneElement, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

// Wraps a single element and shows a styled tooltip above it on hover or focus,
// flipping below when the anchor sits too close to the top of the viewport.
// Renders into document.body through a portal so scrolling containers and
// `overflow: hidden` ancestors can never clip it.

const EDGE_MARGIN = 8
const ANCHOR_GAP = 8

export default function Tooltip({ label, children }) {
  const anchorRef = useRef(null)
  const bubbleRef = useRef(null)
  const [position, setPosition] = useState(null)

  function show() {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPosition({
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
      placement: 'above',
    })
  }

  const hide = () => setPosition(null)

  // The bubble is centred above its anchor, which pushes it off screen when the
  // anchor sits near an edge — so once it has measured dimensions, it is pulled
  // back inside the viewport (and flipped underneath a header-height anchor)
  // before the browser paints it.
  useLayoutEffect(() => {
    if (!position) return
    const bubble = bubbleRef.current
    if (!bubble) return
    const half = bubble.offsetWidth / 2
    const clamped = Math.min(
      Math.max(position.x, half + EDGE_MARGIN),
      window.innerWidth - half - EDGE_MARGIN,
    )
    const fitsAbove = position.top - bubble.offsetHeight - ANCHOR_GAP >= EDGE_MARGIN
    const placement = fitsAbove ? 'above' : 'below'
    if (Math.abs(clamped - position.x) > 0.5 || placement !== position.placement) {
      setPosition((current) => (current ? { ...current, x: clamped, placement } : current))
    }
  }, [position])

  const anchor = cloneElement(children, {
    ref: anchorRef,
    onMouseEnter: (event) => {
      show()
      children.props.onMouseEnter?.(event)
    },
    onMouseLeave: (event) => {
      hide()
      children.props.onMouseLeave?.(event)
    },
    onFocus: (event) => {
      show()
      children.props.onFocus?.(event)
    },
    onBlur: (event) => {
      hide()
      children.props.onBlur?.(event)
    },
  })

  return (
    <>
      {anchor}
      {position &&
        createPortal(
          <div
            className={position.placement === 'below' ? 'tooltip is-below' : 'tooltip'}
            role="tooltip"
            ref={bubbleRef}
            style={{
              '--tooltip-x': `${position.x}px`,
              '--tooltip-y': `${position.placement === 'below' ? position.bottom : position.top}px`,
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  )
}
