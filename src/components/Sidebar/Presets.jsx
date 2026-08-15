import { useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { getDefaults } from '../../data/params.js'
import { PRESETS } from '../../data/presets.js'
import { buildPalette } from '../../lib/palette.js'
import ControlSection from '../ControlSection/ControlSection.jsx'
import './Presets.css'

const PERCENT = 100
const GRADIENT_PRECISION = 2

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

  // Matched against the committed settings, so a half-finished slider drag never
  // makes the active preset flicker off and on.
  const activeId = useMemo(() => {
    if (committed.paletteSource !== 'generated') return undefined
    return PRESETS.find((preset) =>
      Object.entries(preset.settings).every(([key, value]) => committed[key] === value),
    )?.id
  }, [committed])

  // One SET_SETTINGS is one undo entry, and customColors travels through
  // untouched so the Custom toggle still has colors to go back to.
  const applyPreset = (preset) =>
    setSettings({ ...settings, ...preset.settings, paletteSource: 'generated' })

  return (
    <ControlSection title="Presets" defaultOpen>
      <div className="preset-grid">
        {PRESETS.map((preset, index) => {
          const isActive = preset.id === activeId
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
    </ControlSection>
  )
}
