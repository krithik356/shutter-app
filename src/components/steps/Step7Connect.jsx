import { useState, useEffect, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';

export default function Step7Connect({ onNext }) {
  const { userId, selectedImageUrl, caption, hashtags, concept } = useWizard();
  const [time, setTime] = useState('9:00 AM');
  const [autoApprove, setAutoApprove] = useState(false);

  // Instagram connection state
  const [igStatus, setIgStatus] = useState(null); // null = checking
  const [statusError, setStatusError] = useState(null);

  // Publish / schedule state
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);

  // ── Poll /api/instagram/status ───────────────────────────────
  const checkStatus = useCallback(async () => {
    setStatusError(null);
    try {
      const res = await fetch('/api/instagram/status', {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error(`Status check failed (${res.status})`);
      const data = await res.json();
      setIgStatus(data);
    } catch (err) {
      setStatusError(err.message);
      setIgStatus({ connected: false });
    }
  }, [userId]);

  // On mount: check URL for OAuth callback result, then poll status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justConnected = params.get('ig_connected') === 'true';
    const connectError = params.get('ig_error') === 'true';

    if (justConnected || connectError) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }

    if (connectError) {
      const reason = params.get('reason') || 'unknown error';
      setStatusError(`Instagram connection failed: ${reason}`);
      setIgStatus({ connected: false });
    } else {
      checkStatus();
    }
  }, [checkStatus]);

  // ── Connect button ─────────────────────────────────────────────
  const handleConnect = () => {
    window.location.href = `/api/instagram/connect?userId=${encodeURIComponent(userId)}`;
  };

  // ── Post Now ───────────────────────────────────────────────────
  const handlePostNow = async () => {
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    const fullCaption = buildCaption();
    try {
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          imageUrl: selectedImageUrl,
          caption: fullCaption,
        }),
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

  // ── Schedule ───────────────────────────────────────────────────
  const handleSchedule = async () => {
    setScheduling(true);
    setPublishError(null);
    setPublishResult(null);

    const fullCaption = buildCaption();
    try {
      const res = await fetch('/api/instagram/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          imageUrl: selectedImageUrl,
          caption: fullCaption,
          postTime: time,
        }),
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

  // ── Helpers ────────────────────────────────────────────────────
  function buildCaption() {
    const tags = (hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    return caption ? `${caption}\n\n${tags}` : tags;
  }

  // ── Render: Connection card ────────────────────────────────────
  const renderConnectionCard = () => {
    if (igStatus === null) {
      return (
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-safelight to-gold flex-shrink-0 animate-pulse" />
            <div>
              <div className="h-4 w-20 bg-ink-3 rounded animate-pulse mb-1" />
              <div className="h-3 w-28 bg-ink-3 rounded animate-pulse" />
            </div>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" />
              </svg>
            </div>
            <div>
              <h3 className="font-display font-semibold text-base mb-0.5">Instagram</h3>
              <div className="font-mono text-xs text-muted">@{igStatus.username}</div>
            </div>
          </div>
          <span className="font-mono text-[11px] text-gold border border-gold px-2.5 py-1 rounded-full">
            Connected
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg border border-hair bg-ink-3 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div>
            <h3 className="font-display font-semibold text-base mb-0.5">Instagram</h3>
            <div className="font-mono text-xs text-muted">Not connected</div>
          </div>
        </div>
        {statusError && (
          <p className="text-red-400 text-xs font-mono bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {statusError}
          </p>
        )}
        <button
          onClick={handleConnect}
          className="self-start bg-gradient-to-r from-purple-600 to-pink-500 text-paper font-semibold text-sm rounded-md px-5 py-2.5 hover:opacity-90 transition-opacity"
        >
          Connect Instagram →
        </button>
        <p className="font-mono text-[11px] text-muted leading-relaxed">
          You'll be redirected to Instagram to authorize Shutter. Only Business or Creator accounts are supported.
        </p>
      </div>
    );
  };

  // ── Main render ────────────────────────────────────────────────
  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 7 — Wire it up
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Connect Instagram &amp; publish
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        Review your post below, connect your Instagram, then post immediately or schedule it.
      </p>

      {/* Post preview card */}
      {selectedImageUrl && (
        <div className="bg-ink-2 border border-hair rounded-xl overflow-hidden mb-5">
          <div className="font-mono text-[11px] text-muted uppercase tracking-wider px-6 pt-5 pb-2">
            Post preview
          </div>
          <div className="flex flex-col md:flex-row gap-5 p-5 pt-0">
            <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden flex-shrink-0 bg-ink-3">
              <img
                src={selectedImageUrl}
                alt="Selected ad"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              {concept?.conceptTitle && (
                <div className="font-mono text-[11px] text-safelight uppercase tracking-wider mb-1.5">
                  {concept.conceptTitle.split(':')[0]}
                </div>
              )}
              <p className="text-[14px] leading-relaxed text-paper mb-2.5 line-clamp-4">
                {caption || 'No caption generated yet'}
              </p>
              {hashtags?.length > 0 && (
                <p className="font-mono text-[12px] text-gold leading-relaxed">
                  {hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connection card */}
      <div className="bg-ink-2 border border-hair rounded-xl overflow-hidden">
        {renderConnectionCard()}

        {/* Schedule settings */}
        {igStatus?.connected && (
          <div className="flex flex-wrap items-center gap-3.5 p-5 border-t border-hair">
            <span className="font-mono text-[13px] text-secondary">Schedule for</span>
            <input
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="9:00 AM"
              className="bg-ink-3 border border-hair text-paper font-mono text-[13px] px-3 py-2 rounded-md w-28 focus:outline-none focus:border-safelight"
            />
            <label className="flex items-center gap-2 font-mono text-[13px] text-secondary cursor-pointer ml-auto">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="accent-safelight w-3.5 h-3.5"
              />
              require my approval each time
            </label>
          </div>
        )}
      </div>

      {/* Result / error messages */}
      {publishResult && !publishResult.scheduled && (
        <div className="mt-5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
          <p className="text-emerald-400 text-sm font-mono">
            ✅ Published to @{publishResult.username}!
          </p>
        </div>
      )}
      {publishResult?.scheduled && (
        <div className="mt-5 bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
          <p className="text-blue-400 text-sm font-mono">
            🕐 Scheduled for {new Date(publishResult.scheduledFor).toLocaleString()}
          </p>
        </div>
      )}
      {publishError && (
        <div className="mt-5 bg-red-500/10 border border-red-500/30 rounded-xl p-5">
          <p className="text-red-400 text-sm font-mono">{publishError}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mt-9">
        {igStatus?.connected && selectedImageUrl ? (
          <>
            <button
              onClick={handlePostNow}
              disabled={publishing || scheduling || !!publishResult}
              className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {publishing ? 'Publishing…' : 'Post now'}
            </button>
            <button
              onClick={handleSchedule}
              disabled={publishing || scheduling || !!publishResult}
              className="border border-safelight text-safelight font-semibold text-sm rounded-md px-6 py-3.5 hover:bg-safelight/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {scheduling ? 'Scheduling…' : `Schedule for ${time}`}
            </button>
          </>
        ) : (
          <button
            onClick={onNext}
            disabled={!igStatus?.connected}
            className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start daily automation
          </button>
        )}
        {publishResult && (
          <button
            onClick={onNext}
            className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors"
          >
            Continue to dashboard →
          </button>
        )}
        {!igStatus?.connected && igStatus !== null && (
          <button
            onClick={checkStatus}
            className="border border-hair text-secondary font-semibold text-sm rounded-md px-4 py-3.5 hover:border-secondary transition-colors text-xs font-mono"
          >
            Re-check connection
          </button>
        )}
      </div>
    </div>
  );
}
