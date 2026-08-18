import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { GROUPS, PARAM_REGISTRY } from '../../data/params.js'
import useFocusTrap from '../../hooks/useFocusTrap.js'
import { STORAGE_KEYS, readStoredJson, writeStoredJson } from '../../lib/storage.js'
import ControlSection from '../ControlSection/ControlSection.jsx'
import Control from '../controls/Control.jsx'
import Icon from '../Icon.jsx'
import Presets from './Presets.jsx'
import './Sidebar.css'

const OPEN_BY_DEFAULT = new Set(['Generator', 'Adjustments', 'Steps'])

function loadOpenState() {
  const saved = readStoredJson(STORAGE_KEYS.sidebarSections, {})
  const openState = {}
  for (const group of GROUPS) {
    openState[group] = group in saved ? Boolean(saved[group]) : OPEN_BY_DEFAULT.has(group)
  }
  return openState
}

// One component at every width. Narrow layouts add `.is-drawer`, which lifts the
// same panel out of the grid and floats it over the stage behind a scrim; the
// controls inside it never learn that anything changed.
export default function Sidebar({ isDrawer = false, open = false, onClose }) {
  const { settings, updateParam, commit, setParam, backToGenerated } = useApp()
  const [openState, setOpenState] = useState(loadOpenState)
  const panelRef = useRef(null)

  useEffect(() => {
    writeStoredJson(STORAGE_KEYS.sidebarSections, openState)
  }, [openState])

  useFocusTrap({ containerRef: panelRef, onClose, active: isDrawer && open })

  // Hidden params live in state and the share URL but never render here.
  const paramsByGroup = useMemo(() => {
    const grouped = new Map()
    for (const param of PARAM_REGISTRY) {
      if (param.hidden) continue
      if (param.showIf && !param.showIf(settings)) continue
      const existing = grouped.get(param.group)
      if (existing) existing.push(param)
      else grouped.set(param.group, [param])
    }
    return grouped
  }, [settings])

  const visibleGroups = GROUPS.filter((group) => paramsByGroup.has(group))
  const anyClosed = visibleGroups.some((group) => !openState[group])

  const toggleGroup = (group) =>
    setOpenState((current) => ({ ...current, [group]: !current[group] }))

  const setAllGroups = (shouldOpen) =>
    setOpenState((current) => {
      const next = { ...current }
      for (const group of visibleGroups) next[group] = shouldOpen
      return next
    })

  if (isDrawer && !open) return null

  const drawerProps = isDrawer
    ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Controls', tabIndex: -1 }
    : {}

  const panel = (
    <aside className={isDrawer ? 'sidebar is-drawer' : 'sidebar'} ref={panelRef} {...drawerProps}>
      <div className="sidebar-toolbar">
        <span className="toolbar-label">Controls</span>
        <div className="toolbar-actions">
          <button type="button" className="toggle-all" onClick={() => setAllGroups(anyClosed)}>
            {anyClosed ? 'Expand all' : 'Collapse all'}
          </button>
          {isDrawer && (
            <button
              type="button"
              className="button is-icon-only drawer-close"
              onClick={onClose}
              aria-label="Close controls"
              title="Close controls"
            >
              <Icon name="xmark" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Presets sit above the knobs because that is the order people work in:
          pick a starting point, then tune it. They manage their own open state
          rather than joining the persisted group map, which the registry owns. */}
      <Presets />

      {visibleGroups.map((group) => {
        const params = paramsByGroup.get(group)
        const pausedByCustomPalette = params.some((param) => param.disabledIf?.(settings))

        return (
          <ControlSection
            key={group}
            title={group}
            open={openState[group]}
            onToggle={() => toggleGroup(group)}
          >
            {pausedByCustomPalette && (
              <div className="control-note">
                <Icon name="info" size={13} className="note-icon" />
                <span>
                  Custom palette — generator inputs are paused.
                  <button type="button" className="note-action" onClick={backToGenerated}>
                    Back to generated
                  </button>
                </span>
              </div>
            )}

            {params.map((param) => (
              <Control
                key={param.key}
                param={param}
                value={settings[param.key]}
                updateParam={updateParam}
                commit={commit}
                setParam={setParam}
                disabled={Boolean(param.disabledIf?.(settings))}
              />
            ))}
          </ControlSection>
        )
      })}

      <div className="sidebar-credit">
        Built by{' '}
        <a href="https://adamculpepper.net" target="_blank" rel="noopener noreferrer">
          Adam Culpepper
        </a>
      </div>
    </aside>
  )

  if (!isDrawer) return panel

  return (
    <div className="drawer-scrim" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      {panel}
    </div>
  )
}
