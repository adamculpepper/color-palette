import ColorControl from './ColorControl.jsx'
import SegmentedControl from './SegmentedControl.jsx'
import SelectControl from './SelectControl.jsx'
import SliderControl from './SliderControl.jsx'
import TextControl from './TextControl.jsx'
import ToggleControl from './ToggleControl.jsx'
import './controls.css'

// Dispatches a registry entry to its control. Continuous inputs update live and
// commit when the gesture ends; discrete inputs update and commit at once.
export default function Control({ param, value, updateParam, commit, setParam, disabled = false }) {
  const onChange = (next) => updateParam(param.key, next)
  const onCommit = () => commit()
  const onSet = (next) => setParam(param.key, next)

  switch (param.type) {
    case 'slider':
      return (
        <SliderControl
          param={param}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          disabled={disabled}
        />
      )
    case 'select':
      return <SelectControl param={param} value={value} onChange={onSet} disabled={disabled} />
    case 'segmented':
      return <SegmentedControl param={param} value={value} onChange={onSet} disabled={disabled} />
    case 'toggle':
      return <ToggleControl param={param} value={value} onChange={onSet} disabled={disabled} />
    case 'color':
      return (
        <ColorControl
          param={param}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          disabled={disabled}
        />
      )
    case 'text':
      return (
        <TextControl
          param={param}
          value={value}
          onChange={onChange}
          onCommit={onCommit}
          disabled={disabled}
        />
      )
    default:
      return null
  }
}
