import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { usePalette } from '../../hooks/usePalette.js'
import useQuickExport from '../../hooks/useQuickExport.js'
import Icon from '../Icon.jsx'
import PaletteGrid from '../PaletteGrid/PaletteGrid.jsx'
import PaletteImport from '../PaletteImport/PaletteImport.jsx'
import StageToolbar from './StageToolbar.jsx'
import './Stage.css'

// The palette is built once here and handed down, so a settings change costs one
// buildPalette call no matter how many pieces of the stage read from it.
export default function Stage() {
  const { settings } = useApp()
  const palette = usePalette()
  const { copyCss, downloadPng } = useQuickExport()
  const [importOpen, setImportOpen] = useState(false)

  const colorCount = palette.colors.length
  const swatchCount = colorCount * (palette.meta.stepCount * 2 + 1)

  return (
    <main className="stage" data-preview={settings.previewBackground}>
      <StageToolbar palette={palette} onPasteColors={() => setImportOpen(true)} />

      <div className="stage-canvas">
        <PaletteGrid palette={palette} />
      </div>

      {/* The two exports people reach for constantly, one click from the grid.
          Both write exactly what the export modal would for the same format. */}
      <footer className="stage-footer">
        <span className="stage-tally">
          {colorCount} {colorCount === 1 ? 'color' : 'colors'} &middot; {swatchCount} swatches
        </span>
        <div className="footer-actions">
          <button type="button" className="button" onClick={copyCss} title="Copy the CSS variables">
            <Icon name="copy" size={13} />
            <span className="button-label">Copy CSS</span>
          </button>
          <button type="button" className="button" onClick={downloadPng} title="Download the sheet as a PNG">
            <Icon name="download" size={13} />
            <span className="button-label">PNG</span>
          </button>
        </div>
      </footer>

      {importOpen && <PaletteImport onClose={() => setImportOpen(false)} />}
    </main>
  )
}
