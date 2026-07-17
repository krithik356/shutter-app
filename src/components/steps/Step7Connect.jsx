import { useState, useEffect, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';

export default function Step7Connect({ onNext }) {
  const { userId } = useWizard();
  const [time, setTime] = useState('9:00 AM');
  const [autoApprove, setAutoApprove] = useState(false);

  // Instagram connection state
  const [igStatus, setIgStatus] = useState(null); // null = checking, { connected, username? }
  const [statusError, setStatusError] = useState(null);

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
      // Clean the query param from the URL without a reload
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

  // ── Connect button: full-page redirect to /api/instagram/connect ─
  // This must be a real browser navigation (not fetch) so Instagram's
  // login page loads in full.
  const handleConnect = () => {
    window.location.href = `/api/instagram/connect?userId=${encodeURIComponent(userId)}`;
  };

  // ── Render helpers ───────────────────────────────────────────
  const renderConnectionCard = () => {
    // Checking state
    if (igStatus === null) {
      return (
        <div className="flex items-center justify-between p-6">
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

    // Connected state
    if (igStatus.connected) {
      return (
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-safelight to-gold flex-shrink-0" />
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

    // Not connected state
    return (
      <div className="flex flex-col gap-4 p-6">
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
          You'll be redirected to Instagram to authorize Shutter. Only Business or Creator
          accounts are supported.
        </p>
      </div>
    );
  };

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 7 — Wire it up
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Connect Instagram &amp; set your schedule
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        Once connected, Shutter develops and posts a new ad every day — you'll always get
        to approve first.
      </p>

      <div className="bg-ink-2 border border-hair rounded-xl overflow-hidden">
        {renderConnectionCard()}

        {/* Schedule settings — kept as-is, wired into automation in the n8n phase */}
        <div className="flex flex-wrap items-center gap-3.5 p-6 border-t border-hair">
          <span className="font-mono text-[13px] text-secondary">Post daily at</span>
          <input
            value={time}
            onChange={(e) => setTime(e.target.value)}
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
      </div>

      <div className="flex gap-3 mt-9">
        <button
          onClick={onNext}
          disabled={!igStatus?.connected}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start daily automation
        </button>
        {igStatus?.connected && (
          <button
            onClick={checkStatus}
            className="border border-hair text-secondary font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors"
          >
            Refresh status
          </button>
        )}
        {!igStatus?.connected && igStatus !== null && (
          <button
            onClick={checkStatus}
            className="border border-hair text-secondary font-semibold text-sm rounded-md px-4 py-3.5 hover:border-secondary transition-colors text-xs font-mono"
          >
            Re-check
          </button>
        )}
      </div>
    </div>
  );
}
