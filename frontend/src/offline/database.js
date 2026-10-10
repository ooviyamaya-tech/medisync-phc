import Dexie from 'dexie';

export const offlineDb = new Dexie('medisync-offline');
offlineDb.version(1).stores({ pending: '++id, client_id, kind, created_at' });

export async function queueEntry(kind, payload) {
  await offlineDb.pending.add({ ...payload, kind, client_id: crypto.randomUUID(), created_at: new Date().toISOString() });
}

export async function syncPending() {
  if (!navigator.onLine) return { synced: 0, remaining: await offlineDb.pending.count() };
  const entries = await offlineDb.pending.toArray();
  if (!entries.length) return { synced: 0, remaining: 0 };
  const stock = entries.filter(entry => entry.kind === 'stock');
  const consumption = entries.filter(entry => entry.kind === 'consumption');
  let synced = 0;
  for (let offset = 0; offset < stock.length; offset += 200) {
    const batch = stock.slice(offset, offset + 200);
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/stock/bulk-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('medisync_token')}` },
      body: JSON.stringify({ entries: batch.map(({ kind, id, created_at, ...entry }) => entry) }),
    });
    if (!response.ok) throw new Error('Stock sync failed');
    const result = (await response.json()).data;
    const succeeded = new Set(result.results.filter(item => item.success).map(item => item.client_id));
    if (succeeded.size) await offlineDb.pending.where('client_id').anyOf([...succeeded]).delete();
    synced += succeeded.size;
  }
  for (const entry of consumption) {
    const { kind, id, client_id, created_at, ...payload } = entry;
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/consumption`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('medisync_token')}` }, body: JSON.stringify(payload),
    });
    if (response.ok) { await offlineDb.pending.delete(id); synced += 1; }
  }
  return { synced, remaining: await offlineDb.pending.count() };
}