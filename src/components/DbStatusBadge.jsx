import { useState, useEffect } from 'react';

/**
 * Dev-only fixed badge that shows the MongoDB connection status.
 * Sits in the bottom-right corner, kept completely separate from the
 * wizard step components.
 */
export default function DbStatusBadge() {
  const [status, setStatus] = useState('checking');
  const [dbName, setDbName] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/db-status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setStatus(data.status);
          setDbName(data.database ?? null);
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    check();
    const id = setInterval(check, 15_000); // refresh every 15 s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const colors = {
    connected: 'bg-emerald-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-red-500',
    disconnecting: 'bg-orange-400',
    error: 'bg-red-600',
    checking: 'bg-zinc-500 animate-pulse',
  };

  const dot = colors[status] ?? 'bg-zinc-500';

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 backdrop-blur rounded-full px-3 py-1.5 font-mono text-[11px] text-zinc-400 shadow-lg select-none">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span>
        DB: {status}
        {dbName && status === 'connected' && (
          <span className="text-zinc-500 ml-1">({dbName})</span>
        )}
      </span>
    </div>
  );
}
