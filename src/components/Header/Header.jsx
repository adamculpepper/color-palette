import { useApp } from '../../context/AppContext.jsx'
import { APP_NAME, VERSION } from '../../data/version.js'
import useCopyFlag from '../../hooks/useCopyFlag.js'
import { copyText } from '../../lib/export/download.js'
import { shareUrl } from '../../lib/stateCodec.js'
import Icon from '../Icon.jsx'
import Menu from '../Menu/Menu.jsx'
import { useToast } from '../Toast/Toast.jsx'
import Tooltip from '../Tooltip/Tooltip.jsx'
import './Header.css'

const SEED_RANGE = 2 ** 31

// What Randomize rolls depends on where the colors come from, which is worth
// saying out loud before someone clicks it on a palette they pasted in.
const RANDOMIZE_HELP = {
  custom: 'Rolls the adjustment filters only, so your own colors survive',
  generated: 'Rolls the generator settings for a fresh palette',
}

export default function Header({ onExport, onOpenControls, controlsOpen, isNarrow }) {
  const { theme, toggleTheme, settings, committed, randomize, reset, undo, redo, canUndo, canRedo } = useApp()
  const showToast = useToast()
  const { copied, flagCopied } = useCopyFlag()

  // The link carries the committed settings, so it never captures a slider
  // halfway through a drag.
  async function handleShare() {
    const result = await copyText(shareUrl(committed))
    if (!result.ok) {
      showToast(result.reason)
      return
    }
    flagCopied()
    showToast('Share link copied')
  }

  const themeActionLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'

  // Described once, rendered two ways: as a row of icon buttons where there is
  // room, and as an overflow menu where there is not. Randomize and Export are
  // deliberately not in this list — they hold their place at every width.
  const secondaryActions = [
    { id: 'undo', label: 'Undo', icon: 'undo', onSelect: undo, disabled: !canUndo },
    { id: 'redo', label: 'Redo', icon: 'redo', onSelect: redo, disabled: !canRedo },
    { id: 'reset', label: 'Reset to defaults', icon: 'reset', onSelect: reset },
    {
      id: 'share',
      label: copied ? 'Link copied' : 'Copy share link',
      icon: copied ? 'check' : 'share',
      onSelect: handleShare,
    },
    {
      id: 'theme',
      label: themeActionLabel,
      icon: theme === 'dark' ? 'sun' : 'moon',
      onSelect: toggleTheme,
    },
  ]

  return (
    <header className="app-header">
      <div className="header-lead">
        {isNarrow && (
          <button
            type="button"
            className="button is-icon-only controls-toggle"
            onClick={onOpenControls}
            aria-expanded={controlsOpen}
            aria-haspopup="dialog"
            aria-label="Controls"
            title="Controls"
          >
            <Icon name="sliders" size={16} />
          </button>
        )}

        <div className="brand">
          <Icon name="palette" size={18} className="brand-logo" />
          <span className="brand-name">{APP_NAME}</span>
          <span className="brand-version">v{VERSION}</span>
        </div>
      </div>

      <div className="header-actions">
        <Tooltip label={RANDOMIZE_HELP[settings.paletteSource] || RANDOMIZE_HELP.generated}>
          <button
            type="button"
            className="button is-accent"
            // Entropy is generated in the UI layer and passed down as a seed, so
            // the roll is reproducible and shareable.
            onClick={() => randomize(Math.floor(Math.random() * SEED_RANGE))}
          >
            <Icon name="shuffle" size={16} />
            <span className="action-label">Randomize</span>
          </button>
        </Tooltip>

        {isNarrow ? (
          <Menu label="More actions" items={secondaryActions} align="end" />
        ) : (
          <>
            <span className="action-divider" />
            {secondaryActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="button is-icon-only"
                onClick={action.onSelect}
                disabled={action.disabled}
                title={action.label}
                aria-label={action.label}
              >
                <Icon name={action.icon} size={16} />
              </button>
            ))}
          </>
        )}

        <button
          type="button"
          className="button is-primary"
          onClick={onExport}
          disabled={!onExport}
          title="Export this palette"
        >
          <Icon name="download" size={16} />
          <span className="action-label">Export</span>
        </button>
      </div>
    </header>
  )
}
