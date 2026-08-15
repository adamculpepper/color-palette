import { useEffect, useState } from 'react'

// The layout breakpoints, exported so the components and the stylesheets read
// from one list. Every value stops just short of the round number so a viewport
// sitting exactly on the boundary matches one side only.
export const NARROW_LAYOUT = '(max-width: 899.98px)'
export const COMPACT_LABELS = '(max-width: 719.98px)'
export const NO_CELL_LABELS = '(max-width: 479.98px)'

// Tracks a media query as React state. Used for the layout switches (drawer
// sidebar, label degradation) so behavior and CSS agree on one breakpoint.
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const handleChange = (event) => setMatches(event.matches)
    setMatches(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [query])

  return matches
}
