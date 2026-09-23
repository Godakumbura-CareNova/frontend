import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react';

export const TOAST_DURATION_MS = 4000;

// A no-op default keeps components usable (and testable) without a provider above them.
const ToastContext = createContext({ showToast: () => {}, dismissToast: () => {} });

export const useToast = () => useContext(ToastContext);

let toastSequence = 0;

/**
 * App-level toast notifications: short confirmations that appear over the page and fade out
 * on their own, instead of pushing a banner into the layout. Tones: 'success' (green) for
 * something saved, 'danger' (red) for something removed, 'error' (red) for a failure.
 * Errors that need a decision (retry, fix a field) still belong inline, next to what failed.
 */
export const ToastProvider = ({ children, duration = TOAST_DURATION_MS }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message, tone = 'success') => {
      const text = (message ?? '').toString().trim();
      if (!text) return null;

      toastSequence += 1;
      const id = toastSequence;
      setToasts((current) => [...current, { id, message: text, tone }]);
      timers.current.set(id, setTimeout(() => dismissToast(id), duration));
      return id;
    },
    [dismissToast, duration],
  );

  // Pending timers would otherwise fire against an unmounted provider.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
              <span className="toast-icon" aria-hidden="true">
                {toast.tone === 'error' && <AlertTriangle size={17} />}
                {toast.tone === 'danger' && <Trash2 size={17} />}
                {toast.tone !== 'error' && toast.tone !== 'danger' && <CheckCircle2 size={17} />}
              </span>
              <span className="toast-message">{toast.message}</span>
              <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export default ToastContext;
