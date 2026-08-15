import { PARAM_BY_KEY } from '../../data/params.js'
import { QUALITY_RANGE } from '../../lib/export/index.js'
import { RASTER_SCALES } from '../../lib/export/raster.js'
import { SHEET_LAYOUTS } from '../../lib/export/svg.js'
import Control from '../controls/Control.jsx'

// The image options are registry-shaped so the sidebar's control dispatcher
// renders them, which is why they look and behave exactly like every other knob
// in the app while writing to per-format export state instead of settings.

const LAYOUT_LABELS = { grid: 'Every step', row: 'Base colors' }

const SCALE_PARAM = {
  key: 'scale',
  type: 'segmented',
  label: 'Scale',
  options: RASTER_SCALES.map((scale) => ({ value: scale, label: `${scale}x` })),
  help: 'Multiplies the sheet, so 3x lands a print-ready bitmap.',
}

const LAYOUT_PARAM = {
  key: 'layout',
  type: 'segmented',
  label: 'Layout',
  options: SHEET_LAYOUTS.map((layout) => ({ value: layout, label: LAYOUT_LABELS[layout] })),
  help: 'Base colors drops the tint and shade columns.',
}

const LABELS_PARAM = {
  key: 'showLabels',
  type: 'toggle',
  label: 'Labels',
  help: 'Color names down the side, step percentages across the top, values in each swatch.',
}

const BACKGROUND_PARAM = {
  ...PARAM_BY_KEY.previewBackground,
  key: 'background',
  label: 'Background',
}

// Stored as a percent so the slider reads like every other percent dial; the
// encoder gets the 0-1 fraction it expects at the download call site. The range
// travels with the registry entry so the slider, the default and the migration
// of stored options can never disagree about what a quality value means.
const QUALITY_PARAM = {
  key: 'quality',
  type: 'slider',
  label: 'Quality',
  min: QUALITY_RANGE.min,
  max: QUALITY_RANGE.max,
  step: 1,
  unit: '%',
}

// Export options sit outside the settings registry, so there is no history
// checkpoint to commit.
const noCommitNeeded = () => {}

export default function ImageOptions({ format, options, onChange }) {
  const params = [
    // Scale is meaningless for a vector sheet, so only bitmaps get the control.
    ...(format.kind === 'raster' ? [SCALE_PARAM] : []),
    LAYOUT_PARAM,
    LABELS_PARAM,
    BACKGROUND_PARAM,
    ...(format.supportsQuality ? [QUALITY_PARAM] : []),
  ]

  const write = (key, value) => onChange(key, value)

  return (
    <div className="image-options">
      {params.map((param) => (
        <Control
          key={param.key}
          param={param}
          value={options[param.key]}
          updateParam={write}
          commit={noCommitNeeded}
          setParam={write}
        />
      ))}
    </div>
  )
}
