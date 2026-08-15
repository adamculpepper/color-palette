import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import './Toast.css'

const TOAST_DURATION = 2000
const ToastContext = createContext(null)

// One toast at a time, bottom center. The live region is always mounted so a
// screen reader announces the message when it appears rather than announcing
// the region itself.
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const nextToastId = useRef(0)
  const dismissTimer = useRef(null)

  const showToast = useCallback((text) => {
    nextToastId.current += 1
    setToast({ id: nextToastId.current, text })
    clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(() => setToast(null), TOAST_DURATION)
  }, [])

  useEffect(() => () => clearTimeout(dismissTimer.current), [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <span key={toast.id} className="toast">
            {toast.text}
          </span>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context.showToast
}
