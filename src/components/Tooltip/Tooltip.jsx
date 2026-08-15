import { cloneElement, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

// Wraps a single element and shows a styled tooltip above it on hover or focus.
// Renders into document.body through a portal so scrolling containers and
// `overflow: hidden` ancestors can never clip it.

const EDGE_MARGIN = 8

export default function Tooltip({ label, children }) {
  const anchorRef = useRef(null)
  const bubbleRef = useRef(null)
  const [position, setPosition] = useState(null)

  function show() {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPosition({ x: rect.left + rect.width / 2, y: rect.top })
  }

  const hide = () => setPosition(null)

  // The bubble is centred on its anchor, which pushes it off screen when the
  // anchor sits near an edge — so once it has a measured width, it is pulled
  // back inside the viewport before the browser paints it.
  useLayoutEffect(() => {
    if (!position) return
    const bubble = bubbleRef.current
    if (!bubble) return
    const half = bubble.offsetWidth / 2
    const clamped = Math.min(
      Math.max(position.x, half + EDGE_MARGIN),
      window.innerWidth - half - EDGE_MARGIN,
    )
    if (Math.abs(clamped - position.x) > 0.5) {
      setPosition((current) => (current ? { ...current, x: clamped } : current))
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
            className="tooltip"
            role="tooltip"
            ref={bubbleRef}
            style={{ '--tooltip-x': `${position.x}px`, '--tooltip-y': `${position.y}px` }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  )
}
