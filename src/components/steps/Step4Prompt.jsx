import { useState, useEffect, useRef, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';

export default function Step4Prompt({ onNext }) {
  const { userId, setConcept } = useWizard();
  const [conceptTitle, setConceptTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchStarted = useRef(false);

  const fireFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setConceptTitle(data.conceptTitle || '');
      setPrompt(data.imagePrompt || '');
      setConcept({ conceptTitle: data.conceptTitle, imagePrompt: data.imagePrompt });
    } catch (err) {
      setError(err.message || 'Failed to generate concept');
    } finally {
      setLoading(false);
    }
  }, [userId, setConcept]);

  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    fireFetch();
  }, [fireFetch]);

  const handleRetry = () => {
    fetchStarted.current = false;
    fireFetch();
  };

  const handleNext = () => {
    // Save any user edits to the prompt before advancing
    setConcept((prev) => ({ ...prev, imagePrompt: prompt }));
    onNext();
  };

  // Loading state — pulsing card placeholders matching the step's visual identity
  if (loading) {
    return (
      <div>
        <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
          Step 4 — The shot list
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
          Today's ad concept
        </h1>
        <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
          Generating a concept based on your brand kit…
        </p>
        <div className="bg-ink-2 border border-hair rounded-xl p-7 animate-pulse">
          <div className="h-3 w-20 bg-ink-3 rounded mb-4" />
          <div className="h-4 w-3/4 bg-ink-3 rounded mb-2" />
          <div className="h-4 w-1/2 bg-ink-3 rounded" />
        </div>
        <div className="bg-ink-2 border border-hair rounded-xl p-7 mt-4 animate-pulse">
          <div className="h-3 w-24 bg-ink-3 rounded mb-4" />
          <div className="h-24 w-full bg-ink-3 rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
          Step 4 — The shot list
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
          Today's ad concept
        </h1>
        <div className="bg-ink-2 border border-red-500/30 rounded-xl p-7">
          <p className="text-red-400 text-sm font-mono mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="bg-red-500/20 text-red-300 border border-red-500/40 font-semibold text-sm rounded-md px-5 py-2.5 hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loaded state
  // Parse concept title to split angle from detail
  const titleParts = conceptTitle.includes(':') ? conceptTitle.split(':') : ['Concept', conceptTitle];
  const angleLabel = titleParts[0].trim();
  const angleDetail = titleParts.slice(1).join(':').trim();

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 4 — The shot list
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Today's ad concept
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        This is the exact prompt we'll hand to the image generator. Nudge it if you want
        something different.
      </p>

      <div className="bg-ink-2 border border-hair rounded-xl p-7">
        <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-2.5">
          Concept
        </div>
        <p className="text-[14px] leading-relaxed text-secondary">
          <strong className="text-paper font-medium">{angleLabel}:</strong>{' '}
          {angleDetail}
        </p>
      </div>

      <div className="bg-ink-2 border border-hair rounded-xl p-7 mt-4">
        <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-2.5">
          Image prompt
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full bg-ink-3 border border-hair rounded-lg p-4 text-paper font-mono text-[13px] leading-relaxed min-h-[120px] focus:outline-none focus:border-safelight resize-y"
        />
      </div>

      <div className="flex gap-3 mt-9">
        <button
          onClick={handleNext}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity"
        >
          Generate images
        </button>
        <button
          onClick={handleRetry}
          className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors"
        >
          Regenerate concept
        </button>
      </div>
    </div>
  );
}
