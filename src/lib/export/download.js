// Browser glue for handing a finished export to the user.
//
// Nothing under src/lib reads the clock, which the engine fixture enforces, so
// the filename helpers take the moment as an argument and the component that
// starts the download is the one that reads it.
//
// Clipboard support is uneven (Firefox ships no ClipboardItem for images), so
// every copy path reports {ok, reason} instead of throwing and lets the caller
// fall back to a download.

const FILENAME_STEM = 'palette'
const CLIPBOARD_IMAGE_MIME = 'image/png'
const NO_QUALITY_MIME = 'image/png'

function twoDigits(value) {
  return String(value).padStart(2, '0')
}

export function exportTimestamp(moment) {
  return (
    `${moment.getFullYear()}${twoDigits(moment.getMonth() + 1)}${twoDigits(moment.getDate())}` +
    `-${twoDigits(moment.getHours())}${twoDigits(moment.getMinutes())}`
  )
}

export function exportFilename(colorCount, extension, moment) {
  return `${FILENAME_STEM}-${colorCount}colors-${exportTimestamp(moment)}.${extension}`
}

export function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function downloadText(text, filename, mime) {
  saveBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename)
}

export function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve) => {
    // PNG ignores the quality argument, and passing one makes some browsers
    // re-encode needlessly, so it is left off entirely.
    if (mime === NO_QUALITY_MIME || typeof quality !== 'number') {
      canvas.toBlob((blob) => resolve(blob), mime)
      return
    }
    canvas.toBlob((blob) => resolve(blob), mime, quality)
  })
}

export async function downloadCanvas(canvas, filename, mime, quality) {
  const blob = await canvasToBlob(canvas, mime, quality)
  if (!blob) return { ok: false, reason: `This browser cannot encode ${mime}` }
  saveBlob(blob, filename)
  return { ok: true }
}

export async function copyText(text) {
  if (!navigator.clipboard?.writeText) {
    return { ok: false, reason: 'Clipboard access is unavailable here' }
  }
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error?.message || 'The clipboard refused the copy' }
  }
}

export async function copyImage(canvas) {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return { ok: false, reason: 'This browser cannot copy images to the clipboard' }
  }

  // PNG is the only image type clipboards agree on, whatever the export format.
  const blob = await canvasToBlob(canvas, CLIPBOARD_IMAGE_MIME)
  if (!blob) return { ok: false, reason: 'The image could not be encoded' }

  try {
    await navigator.clipboard.write([new ClipboardItem({ [CLIPBOARD_IMAGE_MIME]: blob })])
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error?.message || 'The clipboard refused the image' }
  }
}
