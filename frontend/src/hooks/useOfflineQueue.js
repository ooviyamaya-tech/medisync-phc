import { useEffect, useState } from 'react';
import { offlineDb, syncPending } from '../offline/database.js';
import { useToast } from '../context/ToastContext.jsx';

export function useOfflineQueue() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const toast = useToast();
  useEffect(() => {
    const refresh = () => offlineDb.pending.count().then(setPending);
    const onOnline = async () => {
      setOnline(true);
      try { const result = await syncPending(); await refresh(); if (result.synced) toast(`${result.synced} offline ${result.synced === 1 ? 'entry' : 'entries'} synced`); }
      catch { toast('Some offline entries could not sync yet', 'error'); }
    };
    const onOffline = () => setOnline(false);
    refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const interval = window.setInterval(refresh, 2000);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.clearInterval(interval); };
  }, [toast]);
  return { pending, online };
}