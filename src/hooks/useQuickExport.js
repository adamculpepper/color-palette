import { useCallback } from 'react'
import { useToast } from '../components/Toast/Toast.jsx'
import { useApp } from '../context/AppContext.jsx'
import { copyText, downloadCanvas, exportFilename } from '../lib/export/download.js'
import { defaultFormatOptions, exportFormatById } from '../lib/export/index.js'
import { renderRaster } from '../lib/export/raster.js'
import { buildPalette } from '../lib/palette.js'
import { STORAGE_KEYS, readStoredJson } from '../lib/storage.js'

// The two exports worth reaching without opening the modal: the CSS on the
// clipboard and the sheet as a PNG. The stage footer and the C shortcut both
// call these, so a keyboard copy and a clicked copy produce identical bytes.
//
// The clock is read here, in the UI layer, because nothing under src/lib is
// allowed to — that is what keeps every builder deterministic.

const CSS_FORMAT_ID = 'css'
const PNG_FORMAT_ID = 'png'

function storedOptions(format) {
  const saved = readStoredJson(STORAGE_KEYS.exportOptions, {})
  return { ...defaultFormatOptions(format), ...(saved?.options?.[format.id] || {}) }
}

// A sheet whose background follows the theme needs the resolved token values,
// which only the document can answer for.
function themeSurfaces() {
  const styles = getComputedStyle(document.documentElement)
  return {
    themeColor: styles.getPropertyValue('--stage-bg').trim(),
    checkerBase: styles.getPropertyValue('--checker-base').trim(),
    checkerSquare: styles.getPropertyValue('--checker-square').trim(),
  }
}

export default function useQuickExport() {
  const { settings } = useApp()
  const showToast = useToast()

  const copyCss = useCallback(async () => {
    const format = exportFormatById(CSS_FORMAT_ID)
    const code = format.build(buildPalette(settings), storedOptions(format))
    const result = await copyText(code)
    showToast(result.ok ? 'Copied CSS' : result.reason)
  }, [settings, showToast])

  const downloadPng = useCallback(async () => {
    const format = exportFormatById(PNG_FORMAT_ID)
    const palette = buildPalette(settings)
    const options = { ...storedOptions(format), ...themeSurfaces(), opaque: Boolean(format.opaque) }
    const filename = exportFilename(palette.meta.count, format.ext, new Date())
    const result = await downloadCanvas(renderRaster(palette, options), filename, format.mime)
    showToast(result.ok ? `Saved ${filename}` : result.reason)
  }, [settings, showToast])

  return { copyCss, downloadPng }
}
