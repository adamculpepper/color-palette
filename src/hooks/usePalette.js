import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { buildPalette } from '../lib/palette.js'

// One memo on the live settings object (replaced immutably on every change),
// so the palette recomputes exactly once per state change.
export function usePalette() {
  const { settings } = useApp()
  return useMemo(() => buildPalette(settings), [settings])
}
