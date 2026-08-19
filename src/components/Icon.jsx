import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDownWideShort,
  faArrowRotateLeft,
  faArrowRotateRight,
  faArrowsLeftRightToLine,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faCircleInfo,
  faClone,
  faCopy,
  faDownload,
  faEllipsisVertical,
  faEquals,
  faGripVertical,
  faLock,
  faMinus,
  faMoon,
  faPalette,
  faPaste,
  faPlus,
  faRightLeft,
  faRotateLeft,
  faShareNodes,
  faShuffle,
  faSliders,
  faSun,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import './Icon.css'

// The one place FontAwesome is touched. Components ask for a semantic name so
// swapping a glyph is a single edit here, and nothing else imports an icon.
const ICONS = {
  'chevron-down': faChevronDown,
  'chevron-left': faChevronLeft,
  'chevron-right': faChevronRight,
  'ellipsis-vertical': faEllipsisVertical,
  'grip-vertical': faGripVertical,
  check: faCheck,
  copy: faCopy,
  distribute: faArrowsLeftRightToLine,
  download: faDownload,
  duplicate: faClone,
  equals: faEquals,
  info: faCircleInfo,
  lock: faLock,
  minus: faMinus,
  moon: faMoon,
  palette: faPalette,
  paste: faPaste,
  plus: faPlus,
  redo: faArrowRotateRight,
  reset: faRotateLeft,
  reverse: faRightLeft,
  share: faShareNodes,
  shuffle: faShuffle,
  sliders: faSliders,
  sort: faArrowDownWideShort,
  sun: faSun,
  trash: faTrash,
  undo: faArrowRotateLeft,
  xmark: faXmark,
}

export default function Icon({ name, size = 16, className = '' }) {
  const definition = ICONS[name]
  if (!definition) return null

  return (
    <FontAwesomeIcon
      icon={definition}
      aria-hidden="true"
      className={className ? `app-icon ${className}` : 'app-icon'}
      style={{ '--icon-size': `${size}px` }}
    />
  )
}
