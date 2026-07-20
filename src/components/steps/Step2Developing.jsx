import { useEffect, useState, useRef, useCallback } from 'react';
import { ANALYSIS_ITEMS } from '../../data/mockData';
import { useWizard } from '../../context/WizardContext';

export default function Step2Developing({ onDone }) {
  const { userId, websiteUrl, setBrandKit } = useWizard();
  const [activeIdx, setActiveIdx] = useState(0);
  const [fetchDone, setFetchDone] = useState(false);
  const [error, setError] = useState(null);
  const fetchStarted = useRef(false);

  const fireFetch = useCallback(async () => {
    setError(null);
    setFetchDone(false);
    setActiveIdx(0);

    try {
      const res = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          websiteUrl,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setBrandKit(data);
      setFetchDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }, [userId, websiteUrl, setBrandKit]);

  // Fire the API call on mount
  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    fireFetch();
  }, [fireFetch]);

  // Drive the checklist animation independently from the fetch
  useEffect(() => {
    // If there's an error, stop animating
    if (error) return;

    // If the fetch is done, mark all items as done and advance
    if (fetchDone) {
      setActiveIdx(ANALYSIS_ITEMS.length);
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }

    // While fetch is still pending, tick through items at intervals
    // but stop at the last item (keep it spinning until fetch resolves)
    if (activeIdx < ANALYSIS_ITEMS.length - 1) {
      const t = setTimeout(() => setActiveIdx((i) => i + 1), 700);
      return () => clearTimeout(t);
    }
  }, [activeIdx, fetchDone, error, onDone]);

  const handleRetry = () => {
    fetchStarted.current = false;
    setActiveIdx(0);
    fireFetch();
  };

  // Display-friendly URL for the heading
  const displayUrl = websiteUrl?.replace(/^https?:\/\//, '') || 'your site';

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 2 — Developing
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Reading {displayUrl}
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        This usually takes under a minute. Here's what we're picking up on.
      </p>
      <div className="flex flex-col md:flex-row gap-10 items-start md:items-center">
        <div className="w-44 h-44 rounded-lg border border-hair relative overflow-hidden flex-shrink-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #1C1F24 0 2px, #24282F 2px 4px)',
          }}>
          {!error && <div className="absolute inset-0 bg-safelight animate-pulse-soft" />}
          {error && (
            <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
              <span className="text-red-400 text-2xl">!</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3.5 flex-1">
          {ANALYSIS_ITEMS.map((item, i) => {
            const done = i < activeIdx || (fetchDone && i <= activeIdx);
            const active = i === activeIdx && !fetchDone && !error;
            const failed = error && i === activeIdx;
            return (
              <div
                key={item}
                className={`flex items-center gap-3 font-mono text-[13.5px] ${
                  failed ? 'text-red-400' : done ? 'text-secondary' : active ? 'text-paper' : 'text-muted'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                    failed ? 'bg-red-500/20 border-red-500' : done ? 'bg-gold border-gold' : active ? 'border-safelight' : 'border-hair'
                  }`}
                >
                  {done && <span className="w-1.5 h-1.5 bg-ink rounded-full" />}
                  {active && <span className="w-1.5 h-1.5 bg-safelight rounded-full animate-blink" />}
                  {failed && <span className="text-[10px]">✕</span>}
                </span>
                {item}
              </div>
            );
          })}

          {error && (
            <div className="mt-4">
              <p className="text-red-400 text-sm mb-3 font-mono">
                {error}
              </p>
              <button
                onClick={handleRetry}
                className="bg-red-500/20 text-red-300 border border-red-500/40 font-semibold text-sm rounded-md px-5 py-2.5 hover:bg-red-500/30 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
