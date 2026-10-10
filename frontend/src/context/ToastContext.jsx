import { createContext, useContext, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = (message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts(items => [...items, { id, message, type }]);
    window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 4200);
  };
  return <ToastContext.Provider value={toast}>{children}<div className="toast-stack" aria-live="polite">{toasts.map(item => <div className={`toast toast-${item.type}`} key={item.id}>{item.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}<span>{item.message}</span><button onClick={() => setToasts(items => items.filter(entry => entry.id !== item.id))} aria-label="Dismiss"><X size={16} /></button></div>)}</div></ToastContext.Provider>;
}