import './CodePreview.css'

const BYTES_PER_KB = 1024

export function codeStats(code) {
  const lines = code ? code.replace(/\n$/, '').split('\n').length : 0
  const bytes = code.length
  const size = bytes < BYTES_PER_KB ? `${bytes} B` : `${(bytes / BYTES_PER_KB).toFixed(1)} KB`
  return { lines, bytes, size }
}

// The file exactly as it will be copied or downloaded. tabIndex makes the
// scroll region reachable without a mouse, which a long palette needs.
export default function CodePreview({ code, label }) {
  return (
    <div className="code-preview">
      <pre className="code-block" tabIndex={0} aria-label={`${label} output`}>
        <code>{code}</code>
      </pre>
    </div>
  )
}
