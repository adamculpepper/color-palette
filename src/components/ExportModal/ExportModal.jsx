import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { PARAM_BY_KEY } from '../../data/params.js'
import useCopyFlag from '../../hooks/useCopyFlag.js'
import useFocusTrap from '../../hooks/useFocusTrap.js'
import { usePalette } from '../../hooks/usePalette.js'
import { COLOR_UNITS } from '../../lib/color/format.js'
import {
  copyImage,
  copyText,
  downloadCanvas,
  downloadText,
  exportFilename,
} from '../../lib/export/download.js'
import {
  DEFAULT_FORMAT_ID,
  EXPORT_FORMATS,
  EXPORT_GROUPS,
  exportFormatById,
  exportFormatsInGroup,
  mergeFormatOptions,
} from '../../lib/export/index.js'
import { rasterSize, renderRaster } from '../../lib/export/raster.js'
import { sheetLayout } from '../../lib/export/svg.js'
import { STORAGE_KEYS, readStoredJson, writeStoredJson } from '../../lib/storage.js'
import Control from '../controls/Control.jsx'
import Icon from '../Icon.jsx'
import { useToast } from '../Toast/Toast.jsx'
import CodePreview, { codeStats } from './CodePreview.jsx'
import ImageOptions from './ImageOptions.jsx'
import './ExportModal.css'

// Naming knobs worth reaching without closing the modal. They write the same
// registry params the sidebar owns, so changing one here moves the sidebar too.
const NAMING_PARAM_KEYS = ['colorFormat', 'namePrefix', 'nameStyle', 'stepNaming']

const PREVIEW_DEBOUNCE_MS = 120
const MIN_PREVIEW_SCALE = 0.05
const PERCENT = 100

// Export options live outside the settings registry, so they have no undo
// history to commit to.
const noCommitNeeded = () => {}

function loadExportState() {
  const saved = readStoredJson(STORAGE_KEYS.exportOptions, {})
  const optionsByFormat = {}
  for (const format of EXPORT_FORMATS) {
    optionsByFormat[format.id] = mergeFormatOptions(format, saved.options?.[format.id])
  }
  return { formatId: exportFormatById(saved.format || DEFAULT_FORMAT_ID).id, optionsByFormat }
}

// The sheet exports paint the app's own surfaces when the background follows the
// theme, so the resolved token values travel with the options.
function readThemeColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    themeColor: styles.getPropertyValue('--stage-bg').trim(),
    checkerBase: styles.getPropertyValue('--checker-base').trim(),
    checkerSquare: styles.getPropertyValue('--checker-square').trim(),
  }
}

export default function ExportModal({ onClose }) {
  const palette = usePalette()
  const { settings, theme, updateParam, commit, setParam } = useApp()
  const showToast = useToast()
  const { copied, flagCopied } = useCopyFlag()

  const [exportState, setExportState] = useState(loadExportState)
  const dialogRef = useRef(null)
  const canvasSlotRef = useRef(null)

  const { formatId, optionsByFormat } = exportState
  const format = exportFormatById(formatId)
  const formatOptions = optionsByFormat[format.id]

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.exportOptions, { format: formatId, options: optionsByFormat })
  }, [formatId, optionsByFormat])

  const selectFormat = (id) => setExportState((current) => ({ ...current, formatId: id }))

  const setFormatOption = useCallback((key, value) => {
    setExportState((current) => ({
      ...current,
      optionsByFormat: {
        ...current.optionsByFormat,
        [current.formatId]: { ...current.optionsByFormat[current.formatId], [key]: value },
      },
    }))
  }, [])

  const themeColors = useMemo(readThemeColors, [theme])

  const sheetOptions = useMemo(
    () => ({ ...formatOptions, ...themeColors, opaque: Boolean(format.opaque) }),
    [formatOptions, themeColors, format],
  )

  const code = useMemo(
    () => (format.kind === 'text' ? format.build(palette, sheetOptions) : ''),
    [format, palette, sheetOptions],
  )

  const namingParams = useMemo(
    () => NAMING_PARAM_KEYS.map((key) => {
      const param = PARAM_BY_KEY[key]
      if (key !== 'colorFormat') return param
      // COLOR_UNITS is the authority on which units exist; the registry supplies
      // the labels for them.
      const labelByValue = new Map(param.options.map((option) => [option.value, option.label]))
      return {
        ...param,
        options: COLOR_UNITS.map((unit) => ({ value: unit, label: labelByValue.get(unit) || unit })),
      }
    }),
    [],
  )

  const isImagePreview = format.group === 'image'
  const vectorPreviewSrc = useMemo(
    () => (isImagePreview && format.kind === 'text'
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(code)}`
      : ''),
    [isImagePreview, format, code],
  )

  // Redrawn on a short delay so dragging the quality slider or the swatch size
  // does not repaint the sheet on every frame.
  useEffect(() => {
    if (format.kind !== 'raster') return undefined
    const timer = setTimeout(() => {
      const slot = canvasSlotRef.current
      if (!slot?.clientWidth || !slot.clientHeight) return
      const sheet = sheetLayout(palette, sheetOptions)
      const fitScale = Math.max(
        MIN_PREVIEW_SCALE,
        Math.min(1, slot.clientWidth / sheet.width, slot.clientHeight / sheet.height),
      )
      const canvas = renderRaster(palette, { ...sheetOptions, scale: fitScale })
      canvas.className = 'preview-canvas'
      slot.replaceChildren(canvas)
    }, PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [format, palette, sheetOptions])

  useFocusTrap({ containerRef: dialogRef, onClose })

  function renderExportCanvas() {
    return renderRaster(palette, { ...sheetOptions, scale: formatOptions.scale })
  }

  async function downloadExport() {
    // The clock lives up here in the UI layer; every builder below src/lib stays
    // deterministic so the same palette always produces the same bytes.
    const filename = exportFilename(palette.meta.count, format.ext, new Date())
    if (format.kind === 'text') {
      downloadText(code, filename, format.mime)
      return { ok: true, filename }
    }
    const quality = format.supportsQuality ? formatOptions.quality / PERCENT : undefined
    const result = await downloadCanvas(renderExportCanvas(), filename, format.mime, quality)
    return { ...result, filename }
  }

  async function handleDownload() {
    const result = await downloadExport()
    showToast(result.ok ? `Saved ${result.filename}` : result.reason)
  }

  async function handleCopy() {
    if (format.kind === 'text') {
      const result = await copyText(code)
      if (!result.ok) {
        showToast(result.reason)
        return
      }
      flagCopied()
      showToast(`${format.label} copied`)
      return
    }

    const result = await copyImage(renderExportCanvas())
    if (result.ok) {
      flagCopied()
      showToast(`${format.label} copied as an image`)
      return
    }
    const saved = await downloadExport()
    showToast(saved.ok ? `${result.reason}, so it downloaded instead` : result.reason)
  }

  const metaParts = []
  if (format.kind === 'text') {
    const stats = codeStats(code)
    metaParts.push(`${stats.lines} lines`, stats.size)
  }
  if (isImagePreview) {
    // A vector sheet has one true size, so its readout ignores the bitmap scale.
    const pixels = rasterSize(palette, {
      ...sheetOptions,
      scale: format.kind === 'raster' ? formatOptions.scale : 1,
    })
    metaParts.push(`${pixels.width} × ${pixels.height} px`)
  }

  return (
    <div
      className="export-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="modal-head">
          <div className="modal-heading">
            <h2 className="modal-title" id="export-modal-title">Export</h2>
            <p className="modal-subtitle">
              {palette.meta.count} colors, {palette.colors[0]?.steps.length ?? 0} steps each
            </p>
          </div>
          <button
            type="button"
            className="button is-icon-only"
            onClick={onClose}
            title="Close"
            aria-label="Close export"
          >
            <Icon name="xmark" size={16} />
          </button>
        </header>

        <div className="format-pills">
          {EXPORT_GROUPS.map((group) => (
            <div className="pill-group" key={group.id}>
              <span className="pill-group-label">{group.label}</span>
              <div className="pill-row">
                {exportFormatsInGroup(group.id).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={entry.id === format.id ? 'format-pill is-selected' : 'format-pill'}
                    aria-pressed={entry.id === format.id}
                    onClick={() => selectFormat(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-body">
          <div className="options-pane">
            {isImagePreview ? (
              <ImageOptions format={format} options={formatOptions} onChange={setFormatOption} />
            ) : (
              <div className="naming-options">
                {namingParams.map((param) => (
                  <Control
                    key={param.key}
                    param={param}
                    value={settings[param.key]}
                    updateParam={updateParam}
                    commit={commit}
                    setParam={setParam}
                  />
                ))}
              </div>
            )}

            {(format.toggles || []).map((toggle) => (
              <Control
                key={toggle.key}
                param={{ ...toggle, type: 'toggle' }}
                value={formatOptions[toggle.key]}
                updateParam={setFormatOption}
                commit={noCommitNeeded}
                setParam={setFormatOption}
              />
            ))}
          </div>

          <div className="preview-pane">
            {isImagePreview ? (
              <div className="preview-box">
                {format.kind === 'raster'
                  ? <div className="canvas-slot" ref={canvasSlotRef} />
                  : <img className="preview-image" src={vectorPreviewSrc} alt="Palette swatch sheet preview" />}
              </div>
            ) : (
              <CodePreview code={code} label={format.label} />
            )}
          </div>
        </div>

        <footer className="modal-footer">
          <span className="footer-meta">{metaParts.join(' · ')}</span>
          <div className="footer-actions">
            <button type="button" className="button" onClick={handleCopy}>
              <Icon name="copy" size={16} />
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button type="button" className="button is-primary" onClick={handleDownload}>
              <Icon name="download" size={16} />
              <span>Download</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
