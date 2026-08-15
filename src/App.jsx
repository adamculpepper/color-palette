import { useCallback, useEffect, useState } from 'react'
import ExportModal from './components/ExportModal/ExportModal.jsx'
import Header from './components/Header/Header.jsx'
import Sidebar from './components/Sidebar/Sidebar.jsx'
import Stage from './components/Stage/Stage.jsx'
import { ToastProvider } from './components/Toast/Toast.jsx'
import { AppProvider, useApp } from './context/AppContext.jsx'
import useKeyboard from './hooks/useKeyboard.js'
import useMediaQuery, { NARROW_LAYOUT } from './hooks/useMediaQuery.js'
import { writeHashSettings } from './lib/stateCodec.js'
import './App.css'

const SCROLL_LOCK_CLASS = 'is-scroll-locked'

function AppShell() {
  // Mounted only while open so the modal's palette memo does not shadow the
  // stage's on every slider frame.
  const [exportOpen, setExportOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isNarrow = useMediaQuery(NARROW_LAYOUT)
  const { committed } = useApp()

  // Stable identities: the dialogs hold these across their whole lifetime, and a
  // fresh arrow function on every settings change would tear their focus
  // handling down and put focus back on the button that opened them.
  const openExport = useCallback(() => setExportOpen(true), [])
  const closeExport = useCallback(() => setExportOpen(false), [])
  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Committed settings only: the URL follows finished changes, so a slider drag
  // rewrites the address bar once at pointer-up instead of on every frame. The
  // codec replaces the entry rather than pushing one, so Back still leaves.
  useEffect(() => {
    writeHashSettings(committed)
  }, [committed])

  // Widening the window past the breakpoint puts the sidebar back in the layout,
  // so the drawer state has to let go of it.
  useEffect(() => {
    if (!isNarrow) setDrawerOpen(false)
  }, [isNarrow])

  // Nothing behind the drawer scrolls while it is open, on touch included.
  useEffect(() => {
    const locked = isNarrow && drawerOpen
    document.body.classList.toggle(SCROLL_LOCK_CLASS, locked)
    return () => document.body.classList.remove(SCROLL_LOCK_CLASS)
  }, [isNarrow, drawerOpen])

  useKeyboard({ onExport: openExport })

  return (
    <div className="app">
      <Header
        onExport={openExport}
        onOpenControls={openDrawer}
        controlsOpen={drawerOpen}
        isNarrow={isNarrow}
      />
      <Sidebar isDrawer={isNarrow} open={drawerOpen} onClose={closeDrawer} />
      <Stage />
      {exportOpen && <ExportModal onClose={closeExport} />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppProvider>
  )
}
