import { useState, useEffect, useRef, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';

export default function Step6Caption({ onNext }) {
  const { userId, concept, setCaption: setCtxCaption, setHashtags: setCtxHashtags } = useWizard();
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchStarted = useRef(false);

  const fireFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, conceptTitle: concept?.conceptTitle }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setCaption(data.caption || '');
      setHashtags(data.hashtags || []);
      setCtxCaption(data.caption || '');
      setCtxHashtags(data.hashtags || []);
    } catch (err) {
      setError(err.message || 'Failed to generate caption');
    } finally {
      setLoading(false);
    }
  }, [userId, concept?.conceptTitle, setCtxCaption, setCtxHashtags]);

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
    // Save any user edits to context before advancing
    setCtxCaption(caption);
    setCtxHashtags(hashtags);
    onNext();
  };

  // Format hashtags for display
  const hashtagsDisplay = hashtags
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ');

  // Loading state
  if (loading) {
    return (
      <div>
        <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
          Step 6 — Caption card
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
          Write-up for the post
        </h1>
        <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
          Generating a caption matched to your brand voice…
        </p>
        <div className="bg-ink-2 border border-hair rounded-xl p-7 animate-pulse">
          <div className="h-3 w-16 bg-ink-3 rounded mb-4" />
          <div className="h-4 w-full bg-ink-3 rounded mb-2" />
          <div className="h-4 w-5/6 bg-ink-3 rounded mb-2" />
          <div className="h-4 w-2/3 bg-ink-3 rounded mb-4" />
          <div className="h-3 w-3/4 bg-ink-3 rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
          Step 6 — Caption card
        </div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
          Write-up for the post
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
  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 6 — Caption card
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Write-up for the post
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        Matched to your brand voice. Edit freely — this is exactly what will post.
      </p>

      <div className="bg-ink-2 border border-hair rounded-xl p-7">
        <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-2.5">
          Caption
        </div>
        {editing ? (
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full bg-ink-3 border border-hair rounded-lg p-4 text-paper text-[15px] leading-relaxed min-h-[100px] focus:outline-none focus:border-safelight resize-y"
          />
        ) : (
          <p className="text-[15px] leading-relaxed text-paper">{caption}</p>
        )}
        <div className="font-mono text-[13px] text-gold mt-3">{hashtagsDisplay}</div>
      </div>

      <div className="flex gap-3 mt-9">
        <button
          onClick={handleNext}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity"
        >
          Looks good
        </button>
        <button
          onClick={() => setEditing((e) => !e)}
          className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors"
        >
          {editing ? 'Done editing' : 'Edit caption'}
        </button>
      </div>
    </div>
  );
}
