import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { PARAM_BY_KEY, getDefaults } from '../data/params.js'
import { randomizeSettings } from '../lib/randomize.js'
import { readHashSettings } from '../lib/stateCodec.js'
import { STORAGE_KEYS, readStoredString, writeStoredString } from '../lib/storage.js'

const MAX_HISTORY = 30
const MIN_PALETTE_COLORS = 2
// The color-count knob is the authority on how large a palette may get, and the
// share-URL decoder already stops reading colors there. Enforcing the same
// ceiling on the way IN is what keeps a 40-color paste from looking accepted
// right up until the page is reloaded and the last 16 colors are gone.
export const MAX_PALETTE_COLORS = PARAM_BY_KEY.count.max
const FALLBACK_COLOR = '#808080'

function initialTheme() {
  const stored = readStoredString(STORAGE_KEYS.theme)
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function initState() {
  // A share link boots the app straight into its palette. The hash is untrusted,
  // so the codec hands back a fully validated settings object or nothing at all.
  const settings = readHashSettings() || getDefaults()
  return {
    settings,
    committed: settings,
    past: [],
    future: [],
    theme: initialTheme(),
    selected: null,
  }
}

const sameSettings = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function withHistory(state, nextSettings) {
  return {
    ...state,
    settings: nextSettings,
    committed: nextSettings,
    past: [...state.past, state.committed].slice(-MAX_HISTORY),
    future: [],
  }
}

// Palette edits act on whatever the grid is currently showing. While the source
// is 'generated' there is no stored color array to edit, so the caller hands in
// the displayed (already adjusted) base ramp and it is materialized into
// customColors here — that materialization IS the auto-fork.
function baseColorsFor(state, currentBase) {
  if (state.settings.paletteSource === 'custom') return [...state.settings.customColors]
  if (Array.isArray(currentBase) && currentBase.length > 0) return [...currentBase]
  return [...state.settings.customColors]
}

function withCustomColors(settings, customColors) {
  return { ...settings, paletteSource: 'custom', customColors }
}

function clampSelected(selected, length) {
  if (selected === null || length === 0) return null
  return Math.min(selected, length - 1)
}

function reducer(state, action) {
  switch (action.type) {
    case 'UPDATE_PARAM':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } }

    case 'COMMIT': {
      if (sameSettings(state.settings, state.committed)) return state
      return {
        ...state,
        committed: state.settings,
        past: [...state.past, state.committed].slice(-MAX_HISTORY),
        future: [],
      }
    }

    case 'SET_SETTINGS':
      return withHistory(state, action.settings)

    case 'RESET':
      return withHistory(state, getDefaults())

    // The seed arrives from the UI layer, which is the only place allowed to
    // generate entropy, so the roll is reproducible and lands in the share URL
    // like any other change.
    case 'RANDOMIZE': {
      const randomized = randomizeSettings(state.settings, action.seed)
      return sameSettings(randomized, state.committed) ? state : withHistory(state, randomized)
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        ...state,
        settings: previous,
        committed: previous,
        past: state.past.slice(0, -1),
        future: [state.committed, ...state.future].slice(0, MAX_HISTORY),
        selected: clampSelected(state.selected, previous.customColors.length),
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        ...state,
        settings: next,
        committed: next,
        past: [...state.past, state.committed].slice(-MAX_HISTORY),
        future: state.future.slice(1),
        selected: clampSelected(state.selected, next.customColors.length),
      }
    }

    case 'SET_THEME':
      return { ...state, theme: action.theme }

    case 'FORK_TO_CUSTOM': {
      if (state.settings.paletteSource === 'custom') return state
      const colors = baseColorsFor(state, action.currentBase)
      if (colors.length === 0) return state
      return withHistory(state, withCustomColors(state.settings, colors))
    }

    // Live: one drag of a hex field or L/C/H slider is a single history entry,
    // committed by the caller when the gesture ends.
    case 'SET_COLOR': {
      const colors = baseColorsFor(state, action.currentBase)
      if (action.index < 0 || action.index >= colors.length) return state
      colors[action.index] = action.hex
      return { ...state, settings: withCustomColors(state.settings, colors) }
    }

    // `hex` comes from the caller so neighbor interpolation stays in the color
    // engine; without one the neighbor is duplicated.
    case 'ADD_COLOR': {
      const colors = baseColorsFor(state, action.currentBase)
      if (colors.length >= MAX_PALETTE_COLORS) return state
      const at = Number.isInteger(action.index) ? action.index : colors.length - 1
      const neighbor = colors[at] ?? colors[colors.length - 1] ?? FALLBACK_COLOR
      colors.splice(at + 1, 0, action.hex ?? neighbor)
      return {
        ...withHistory(state, withCustomColors(state.settings, colors)),
        selected: at + 1,
      }
    }

    case 'REMOVE_COLOR': {
      const colors = baseColorsFor(state, action.currentBase)
      if (colors.length <= MIN_PALETTE_COLORS) return state
      if (action.index < 0 || action.index >= colors.length) return state
      colors.splice(action.index, 1)
      return {
        ...withHistory(state, withCustomColors(state.settings, colors)),
        selected: clampSelected(state.selected, colors.length),
      }
    }

    case 'MOVE_COLOR': {
      const colors = baseColorsFor(state, action.currentBase)
      const { from, to } = action
      if (from === to) return state
      if (from < 0 || from >= colors.length || to < 0 || to >= colors.length) return state
      const [moved] = colors.splice(from, 1)
      colors.splice(to, 0, moved)
      return {
        ...withHistory(state, withCustomColors(state.settings, colors)),
        selected: state.selected === from ? to : state.selected,
      }
    }

    // Paste, sort, reverse and distribute all land here with a finished array.
    case 'REPLACE_COLORS': {
      if (!Array.isArray(action.colors) || action.colors.length === 0) return state
      const colors = action.colors.slice(0, MAX_PALETTE_COLORS)
      return {
        ...withHistory(state, withCustomColors(state.settings, colors)),
        selected: clampSelected(state.selected, colors.length),
      }
    }

    // UI-only: deliberately outside settings so selection never enters history
    // or the share URL.
    case 'SET_SELECTED':
      return { ...state, selected: action.index }

    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    writeStoredString(STORAGE_KEYS.theme, state.theme)
  }, [state.theme])

  const actions = useMemo(
    () => ({
      updateParam: (key, value) => dispatch({ type: 'UPDATE_PARAM', key, value }),
      commit: () => dispatch({ type: 'COMMIT' }),
      setParam: (key, value) => {
        dispatch({ type: 'UPDATE_PARAM', key, value })
        dispatch({ type: 'COMMIT' })
      },
      setSettings: (settings) => dispatch({ type: 'SET_SETTINGS', settings }),
      reset: () => dispatch({ type: 'RESET' }),
      randomize: (seed) => dispatch({ type: 'RANDOMIZE', seed }),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      setTheme: (theme) => dispatch({ type: 'SET_THEME', theme }),
      toggleTheme: () =>
        dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' }),
      forkToCustom: (currentBase) => dispatch({ type: 'FORK_TO_CUSTOM', currentBase }),
      setColor: (index, hex, currentBase) => dispatch({ type: 'SET_COLOR', index, hex, currentBase }),
      addColor: (index, hex, currentBase) => dispatch({ type: 'ADD_COLOR', index, hex, currentBase }),
      removeColor: (index, currentBase) => dispatch({ type: 'REMOVE_COLOR', index, currentBase }),
      moveColor: (from, to, currentBase) => dispatch({ type: 'MOVE_COLOR', from, to, currentBase }),
      replaceColors: (colors) => dispatch({ type: 'REPLACE_COLORS', colors }),
      // customColors survive the trip back, so the toggle is lossless.
      backToGenerated: () => {
        dispatch({ type: 'UPDATE_PARAM', key: 'paletteSource', value: 'generated' })
        dispatch({ type: 'COMMIT' })
      },
      setSelected: (index) => dispatch({ type: 'SET_SELECTED', index }),
    }),
    [state.theme],
  )

  const value = useMemo(
    () => ({
      ...state,
      ...actions,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, actions],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
