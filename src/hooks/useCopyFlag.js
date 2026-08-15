import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_DURATION = 2000

// Drives the short-lived "Copied" state on a button. Repeated copies restart
// the window instead of stacking timers.
export default function useCopyFlag(duration = DEFAULT_DURATION) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef(null)

  const flagCopied = useCallback(() => {
    setCopied(true)
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(false), duration)
  }, [duration])

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  return { copied, flagCopied }
}
