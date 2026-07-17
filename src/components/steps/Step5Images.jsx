import { useState, useEffect, useRef, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';

export default function Step5Images({ onNext }) {
  const { userId, concept, setSelectedImageUrl } = useWizard();
  const [images, setImages] = useState([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchStarted = useRef(false);

  const fireFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setImages([]);
    try {
      const res = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, imagePrompt: concept?.imagePrompt }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setImages(data.images || []);
      setSelected(0);
    } catch (err) {
      setError(err.message || 'Failed to generate images');
    } finally {
      setLoading(false);
    }
  }, [userId, concept?.imagePrompt]);

  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;
    fireFetch();
  }, [fireFetch]);

  const handleRetry = () => {
    fetchStarted.current = false;
    fireFetch();
  };

  const handleUse = () => {
    if (images.length > 0) {
      setSelectedImageUrl(images[selected]);
    }
    onNext();
  };

  const LABELS = ['Variation A', 'Variation B', 'Variation C'];

  // Loading state — 3 pulsing placeholder cards in the same grid
  if (loading) {
    return (
      <div>
        <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
          Step 5 — Prints
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
          Generating your images
        </h1>
        <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
          This can take a few seconds — we're creating three variations from your prompt.
        </p>
        <div className="grid grid-cols-3 gap-3.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden border-2 border-hair aspect-square bg-ink-2 animate-pulse"
            >
              <div className="w-full h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-muted border-t-safelight animate-spin" />
                  <span className="font-mono text-[11px] text-muted">{LABELS[i]}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
          Step 5 — Prints
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
          Pick your favorite
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

  // Loaded state — real images
  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 5 — Prints
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Pick your favorite
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        Three takes from the same prompt. Select one to move forward, or regenerate for
        new options.
      </p>

      <div className="grid grid-cols-3 gap-3.5">
        {images.map((url, i) => (
          <div
            key={url}
            onClick={() => setSelected(i)}
            className={`rounded-xl overflow-hidden cursor-pointer border-2 transition-colors relative aspect-square bg-ink-2 ${
              selected === i ? 'border-safelight' : 'border-hair'
            }`}
          >
            <img
              src={url}
              alt={LABELS[i] || `Variation ${i + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {selected === i && (
              <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-safelight flex items-center justify-center text-[11px] text-paper">
                ✓
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-9">
        <button
          onClick={handleUse}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity"
        >
          Use this one
        </button>
        <button
          onClick={handleRetry}
          className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors"
        >
          Regenerate all
        </button>
      </div>
    </div>
  );
}
