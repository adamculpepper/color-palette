import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { getDefaults } from '../../data/params.js'
import { PRESETS, PRESETS_PER_PAGE } from '../../data/presets.js'
import { buildPalette } from '../../lib/palette.js'
import ControlSection from '../ControlSection/ControlSection.jsx'
import Icon from '../Icon.jsx'
import './Presets.css'

const PERCENT = 100
const GRADIENT_PRECISION = 2

// The list grows over time, and a sidebar that has to be scrolled past its
// knobs to reach a preset is worse than a page turn.
const PAGE_COUNT = Math.ceil(PRESETS.length / PRESETS_PER_PAGE)

// Thumbnails run the real engine rather than a hand-written list of hexes, so a
// preset can never drift from what clicking it produces. They are built against
// the defaults, not the current settings, which keeps them stable while sliders
// move and lets one useMemo with no dependencies cover the whole list.
function presetGradient(preset) {
  const palette = buildPalette({
    ...getDefaults(),
    ...preset.settings,
    paletteSource: 'generated',
    stepCount: 0,
  })

  const bands = palette.colors.length
  const stops = palette.colors.flatMap((color, index) => [
    `${color.hex} ${((index / bands) * PERCENT).toFixed(GRADIENT_PRECISION)}%`,
    `${color.hex} ${(((index + 1) / bands) * PERCENT).toFixed(GRADIENT_PRECISION)}%`,
  ])

  // Doubled stops give hard edges, so the strip reads as discrete swatches
  // instead of a blend the generator would never produce.
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export default function Presets() {
  const { settings, committed, setSettings } = useApp()
  const gradients = useMemo(() => PRESETS.map(presetGradient), [])
  const [page, setPage] = useState(0)

  // Matched against the committed settings, so a half-finished slider drag never
  // makes the active preset flicker off and on.
  const activeIndex = useMemo(() => {
    if (committed.paletteSource !== 'generated') return -1
    return PRESETS.findIndex((preset) =>
      Object.entries(preset.settings).every(([key, value]) => committed[key] === value),
    )
  }, [committed])

  // Randomize, undo and a share link can all land on a preset that lives on
  // another page; the panel follows rather than showing an empty selection.
  useEffect(() => {
    if (activeIndex < 0) return
    setPage(Math.floor(activeIndex / PRESETS_PER_PAGE))
  }, [activeIndex])

  // One SET_SETTINGS is one undo entry, and customColors travels through
  // untouched so the Custom toggle still has colors to go back to.
  const applyPreset = (preset) =>
    setSettings({ ...settings, ...preset.settings, paletteSource: 'generated' })

  const start = page * PRESETS_PER_PAGE
  const visible = PRESETS.slice(start, start + PRESETS_PER_PAGE)

  return (
    <ControlSection title="Presets" defaultOpen>
      <div className="preset-grid">
        {visible.map((preset, offset) => {
          const index = start + offset
          const isActive = index === activeIndex
          return (
            <button
              key={preset.id}
              type="button"
              className={isActive ? 'preset-button is-active' : 'preset-button'}
              aria-pressed={isActive}
              title={preset.description}
              onClick={() => applyPreset(preset)}
              style={{ '--preset-gradient': gradients[index] }}
            >
              <span className="preset-strip" />
              <span className="preset-label">{preset.label}</span>
            </button>
          )
        })}
      </div>

      {PAGE_COUNT > 1 && (
        <div className="preset-pager">
          <button
            type="button"
            className="button is-icon-only"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            aria-label="Previous presets"
          >
            <Icon name="chevron-left" size={12} />
          </button>
          <span className="pager-position" aria-live="polite">
            {page + 1} of {PAGE_COUNT}
          </span>
          <button
            type="button"
            className="button is-icon-only"
            onClick={() => setPage((current) => Math.min(PAGE_COUNT - 1, current + 1))}
            disabled={page === PAGE_COUNT - 1}
            aria-label="More presets"
          >
            <Icon name="chevron-right" size={12} />
          </button>
        </div>
      )}
    </ControlSection>
  )
}
