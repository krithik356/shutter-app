import { useState, useEffect, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';

// ── Instagram icon SVG ────────────────────────────────────────────
function IgIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none" />
    </svg>
  );
}

// ── New Post Panel (modal) ─────────────────────────────────────────
function NewPostPanel({ wizardImageUrl, wizardCaption, wizardHashtags, onClose }) {
  const [imageUrl, setImageUrl] = useState(wizardImageUrl || '');
  const [caption, setCaption] = useState(() => {
    const tags = (wizardHashtags || [])
      .map((h) => (h.startsWith('#') ? h : `#${h}`))
      .join(' ');
    return wizardCaption ? `${wizardCaption}${tags ? '\n\n' + tags : ''}` : tags;
  });
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Demo thumbnail options — wizard image + 3 picsum placeholders
  const demoImages = [
    wizardImageUrl && { url: wizardImageUrl, label: 'Your selected image' },
    { url: 'https://picsum.photos/seed/421/1024/1024', label: 'Demo photo 1' },
    { url: 'https://picsum.photos/seed/458/1024/1024', label: 'Demo photo 2' },
    { url: 'https://picsum.photos/seed/495/1024/1024', label: 'Demo photo 3' },
  ].filter(Boolean);

  const handlePost = async () => {
    if (!imageUrl.trim()) { setError('Please enter or select an image URL'); return; }
    if (!caption.trim()) { setError('Please enter a caption'); return; }
    setPosting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/instagram/post-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: imageUrl.trim(), caption: caption.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Post failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[#111316] border border-[#2a2d33] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2d33]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
              <IgIcon size={14} color="white" />
            </div>
            <span className="font-semibold text-base text-white">New Instagram Post</span>
          </div>
          <button onClick={onClose} className="text-[#666] hover:text-white transition-colors text-xl leading-none px-1">✕</button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Image selector */}
          <div>
            <div className="font-mono text-[11px] text-[#666] uppercase tracking-wider mb-2.5">
              Image (must be a public URL Instagram can reach)
            </div>

            {/* Quick-pick thumbnails */}
            <div className="flex gap-2 mb-3">
              {demoImages.map((d) => (
                <button
                  key={d.url}
                  onClick={() => setImageUrl(d.url)}
                  title={d.label}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                    imageUrl === d.url ? 'border-[#C9A97A] scale-105' : 'border-[#2a2d33] hover:border-[#555]'
                  }`}
                >
                  <img src={d.url} alt={d.label} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>

            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full bg-[#1a1d22] border border-[#2a2d33] text-white font-mono text-[13px] px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#C9A97A] placeholder-[#444]"
            />

            {/* Live preview */}
            {imageUrl && (
              <div className="mt-3 rounded-lg overflow-hidden bg-[#1a1d22] border border-[#2a2d33] max-h-48">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover max-h-48"
                  onError={(e) => { e.target.style.opacity = '0'; }} />
              </div>
            )}
          </div>

          {/* Caption editor */}
          <div>
            <div className="font-mono text-[11px] text-[#666] uppercase tracking-wider mb-2.5">Caption + Hashtags</div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption here… include hashtags at the end."
              rows={5}
              className="w-full bg-[#1a1d22] border border-[#2a2d33] text-white text-[14px] leading-relaxed px-4 py-3 rounded-lg focus:outline-none focus:border-[#C9A97A] resize-y placeholder-[#444]"
            />
            <div className="font-mono text-[11px] text-[#555] mt-1 text-right">{caption.length} chars</div>
          </div>

          {/* Status messages */}
          {posting && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-center gap-3">
              <span className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
              <p className="text-blue-400 text-sm font-mono">Creating container and publishing… (~12 seconds)</p>
            </div>
          )}
          {result?.success && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-emerald-400 text-sm font-mono">✅ Posted! Instagram Post ID: {result.igPostId}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-sm font-mono">❌ {error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-[#2a2d33]">
          {result?.success ? (
            <button onClick={onClose} className="bg-emerald-600 text-white font-semibold text-sm rounded-lg px-6 py-3 hover:opacity-90 transition-opacity">Done ✓</button>
          ) : (
            <button
              onClick={handlePost}
              disabled={posting || !imageUrl || !caption}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-sm rounded-lg px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {posting ? (
                <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Posting…</>
              ) : (
                <><IgIcon size={15} color="white" />Post to Instagram Now</>
              )}
            </button>
          )}
          <button onClick={onClose} className="border border-[#2a2d33] text-[#999] font-semibold text-sm rounded-lg px-5 py-3 hover:border-[#444] hover:text-white transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Step7Connect ──────────────────────────────────────────────
export default function Step7Connect({ onNext }) {
  const { userId, selectedImageUrl, caption, hashtags, concept } = useWizard();
  const [time, setTime] = useState('9:00 AM');
  const [autoApprove, setAutoApprove] = useState(false);

  const [igStatus, setIgStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);

  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);

  const [showNewPost, setShowNewPost] = useState(false);

  const checkStatus = useCallback(async () => {
    setStatusError(null);
    try {
      const res = await fetch('/api/instagram/status', { headers: { 'x-user-id': userId } });
      if (!res.ok) throw new Error(`Status check failed (${res.status})`);
      setIgStatus(await res.json());
    } catch (err) {
      setStatusError(err.message);
      setIgStatus({ connected: false });
    }
  }, [userId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justConnected = params.get('ig_connected') === 'true';
    const connectError = params.get('ig_error') === 'true';
    if (justConnected || connectError) window.history.replaceState({}, '', window.location.pathname);
    if (connectError) {
      setStatusError(`Instagram connection failed: ${params.get('reason') || 'unknown error'}`);
      setIgStatus({ connected: false });
    } else {
      checkStatus();
    }
  }, [checkStatus]);

  const handleConnect = () => {
    window.location.href = `/api/instagram/connect?userId=${encodeURIComponent(userId)}`;
  };

  const buildCaption = () => {
    const tags = (hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    return caption ? `${caption}\n\n${tags}` : tags;
  };

  const handlePostNow = async () => {
    setPublishing(true); setPublishError(null); setPublishResult(null);
    try {
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ imageUrl: selectedImageUrl, caption: buildCaption() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Publish failed');
      setPublishResult(data);
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleSchedule = async () => {
    setScheduling(true); setPublishError(null); setPublishResult(null);
    try {
      const res = await fetch('/api/instagram/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ imageUrl: selectedImageUrl, caption: buildCaption(), postTime: time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Schedule failed');
      setPublishResult({ scheduled: true, ...data });
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  const renderConnectionCard = () => {
    if (igStatus === null) {
      return (
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-safelight to-gold flex-shrink-0 animate-pulse" />
            <div><div className="h-4 w-20 bg-ink-3 rounded animate-pulse mb-1" /><div className="h-3 w-28 bg-ink-3 rounded animate-pulse" /></div>
          </div>
          <div className="h-6 w-20 bg-ink-3 rounded-full animate-pulse" />
        </div>
      );
    }
    if (igStatus.connected) {
      return (
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex-shrink-0 flex items-center justify-center">
              <IgIcon size={16} color="white" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base mb-0.5">Instagram</h3>
              <div className="font-mono text-xs text-muted">@{igStatus.username}</div>
            </div>
          </div>
          <span className="font-mono text-[11px] text-gold border border-gold px-2.5 py-1 rounded-full">Connected</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg border border-hair bg-ink-3 flex items-center justify-center flex-shrink-0">
            <IgIcon size={18} color="#666" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base mb-0.5">Instagram</h3>
            <div className="font-mono text-xs text-muted">Not connected</div>
          </div>
        </div>
        {statusError && <p className="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{statusError}</p>}
        <button onClick={handleConnect} className="self-start bg-gradient-to-r from-purple-600 to-pink-500 text-paper font-semibold text-sm rounded-md px-5 py-2.5 hover:opacity-90 transition-opacity">
          Connect Instagram →
        </button>
        <p className="font-mono text-[11px] text-muted leading-relaxed">Only Business or Creator accounts are supported. You'll be redirected to Instagram to authorize.</p>
      </div>
    );
  };

  return (
    <>
      {showNewPost && (
        <NewPostPanel
          wizardImageUrl={selectedImageUrl}
          wizardCaption={caption}
          wizardHashtags={hashtags}
          onClose={() => setShowNewPost(false)}
        />
      )}

      <div>
        <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">Step 7 — Wire it up</div>
        <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">Connect Instagram &amp; publish</h1>
        <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
          Review your post, connect Instagram, then post immediately, schedule it, or tap <strong className="text-paper">Add Post</strong> for a quick one-click publish.
        </p>

        {/* ── NEW POST card ──────────────────────────────────────── */}
        <div className="bg-ink-2 border border-hair rounded-xl overflow-hidden mb-5">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div>
                <h3 className="font-display font-semibold text-base mb-0.5 text-paper">New Post</h3>
                <p className="font-mono text-[12px] text-muted">Pick an image &amp; caption — post directly to Instagram</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewPost(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold text-sm rounded-lg px-5 py-2.5 hover:opacity-90 transition-all hover:scale-105 flex-shrink-0"
            >
              <IgIcon size={14} color="white" />
              Add Post
            </button>
          </div>

          {selectedImageUrl && (
            <div className="flex items-center gap-4 px-5 pb-5 border-t border-hair">
              <img src={selectedImageUrl} alt="Selected" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-hair mt-3" />
              <div className="flex-1 min-w-0 mt-3">
                <p className="text-[13px] text-secondary line-clamp-2 leading-snug">{caption || 'No caption yet'}</p>
                {hashtags?.length > 0 && (
                  <p className="font-mono text-[11px] text-gold mt-0.5">
                    {hashtags.slice(0, 4).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}{hashtags.length > 4 && ' …'}
                  </p>
                )}
              </div>
              <button onClick={() => setShowNewPost(true)} className="font-mono text-[12px] text-safelight hover:text-paper transition-colors flex-shrink-0 mt-3">
                Edit &amp; Post →
              </button>
            </div>
          )}
        </div>

        {/* Post preview */}
        {selectedImageUrl && (
          <div className="bg-ink-2 border border-hair rounded-xl overflow-hidden mb-5">
            <div className="font-mono text-[11px] text-muted uppercase tracking-wider px-6 pt-5 pb-2">Post preview</div>
            <div className="flex flex-col md:flex-row gap-5 p-5 pt-0">
              <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden flex-shrink-0 bg-ink-3">
                <img src={selectedImageUrl} alt="Selected ad" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                {concept?.conceptTitle && (
                  <div className="font-mono text-[11px] text-safelight uppercase tracking-wider mb-1.5">{concept.conceptTitle.split(':')[0]}</div>
                )}
                <p className="text-[14px] leading-relaxed text-paper mb-2.5 line-clamp-4">{caption || 'No caption generated yet'}</p>
                {hashtags?.length > 0 && (
                  <p className="font-mono text-[12px] text-gold leading-relaxed">{hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Connection card */}
        <div className="bg-ink-2 border border-hair rounded-xl overflow-hidden">
          {renderConnectionCard()}
          {igStatus?.connected && (
            <div className="flex flex-wrap items-center gap-3.5 p-5 border-t border-hair">
              <span className="font-mono text-[13px] text-secondary">Schedule for</span>
              <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="9:00 AM"
                className="bg-ink-3 border border-hair text-paper font-mono text-[13px] px-3 py-2 rounded-md w-28 focus:outline-none focus:border-safelight" />
              <label className="flex items-center gap-2 font-mono text-[13px] text-secondary cursor-pointer ml-auto">
                <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="accent-safelight w-3.5 h-3.5" />
                require my approval each time
              </label>
            </div>
          )}
        </div>

        {publishResult && !publishResult.scheduled && (
          <div className="mt-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
            <p className="text-emerald-400 text-sm font-mono">✅ Published to @{publishResult.username}!</p>
          </div>
        )}
        {publishResult?.scheduled && (
          <div className="mt-5 bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
            <p className="text-blue-400 text-sm font-mono">🕐 Scheduled for {new Date(publishResult.scheduledFor).toLocaleString()}</p>
          </div>
        )}
        {publishError && (
          <div className="mt-5 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
            <p className="text-red-400 text-sm font-mono">{publishError}</p>
          </div>
        )}

        <div className="flex gap-3 mt-9">
          {igStatus?.connected && selectedImageUrl ? (
            <>
              <button onClick={handlePostNow} disabled={publishing || scheduling || !!publishResult}
                className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                {publishing ? 'Publishing…' : 'Post now'}
              </button>
              <button onClick={handleSchedule} disabled={publishing || scheduling || !!publishResult}
                className="border border-safelight text-safelight font-semibold text-sm rounded-md px-6 py-3.5 hover:bg-safelight/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {scheduling ? 'Scheduling…' : `Schedule for ${time}`}
              </button>
            </>
          ) : (
            <button onClick={onNext} disabled={!igStatus?.connected}
              className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
              Start daily automation
            </button>
          )}
          {publishResult && (
            <button onClick={onNext} className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors">
              Continue to dashboard →
            </button>
          )}
          {!igStatus?.connected && igStatus !== null && (
            <button onClick={checkStatus} className="border border-hair text-secondary font-semibold text-xs font-mono rounded-md px-4 py-3.5 hover:border-secondary transition-colors">
              Re-check connection
            </button>
          )}
        </div>
      </div>
    </>
  );
}
