import { useState, useEffect, useCallback } from 'react';
import { useWizard } from '../../context/WizardContext';

export default function Step8Dashboard() {
  const { userId, selectedImageUrl, caption, hashtags } = useWizard();
  const getDefaultDateTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}:${min}`,
    };
  };

  const [scheduleDate, setScheduleDate] = useState(() => getDefaultDateTime().date);
  const [scheduleTime, setScheduleTime] = useState(() => getDefaultDateTime().time);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [scheduleSuccess, setScheduleSuccess] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/posts', {
        headers: { 'x-user-id': userId },
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setHistory(data.posts || []);
    } catch (err) {
      console.error('Failed to load post history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const buildCaption = () => {
    const tags = (hashtags || []).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
    return caption ? `${caption}\n\n${tags}` : tags;
  };

  const handleSchedulePost = async () => {
    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Please select a date and time');
      return;
    }

    const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);
    const now = new Date();

    if (scheduledDateTime <= now) {
      setScheduleError('Scheduled time must be in the future');
      return;
    }

    if (!selectedImageUrl) {
      setScheduleError('No image selected');
      return;
    }

    setScheduling(true);
    setScheduleError(null);
    setScheduleSuccess(null);

    try {
      const res = await fetch('/api/instagram/schedule-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          imageUrl: selectedImageUrl,
          caption: buildCaption(),
          scheduledFor: scheduledDateTime.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Schedule failed');
      
      const isToday = scheduledDateTime.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = scheduledDateTime.toDateString() === tomorrow.toDateString();
      const dateStr = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : scheduledDateTime.toLocaleDateString();
      const timeStr = scheduledDateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      
      setScheduleSuccess(`✅ Post scheduled for ${dateStr} at ${timeStr}`);
      const defaults = getDefaultDateTime();
      setScheduleDate(defaults.date);
      setScheduleTime(defaults.time);
      fetchHistory(); // Refresh post history immediately
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setScheduling(false);
    }
  };

  const postedCount = history.filter((p) => p.status === 'posted').length;

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 8 — Darkroom
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Your feed, always fresh
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-8">
        A new frame develops every morning. Review it before it goes live, or let it run.
      </p>

      <div className="flex items-center justify-between bg-safelight-dim border border-safelight rounded-xl px-6 py-5 mb-8">
        <div>
          <div className="font-mono text-xs text-safelight uppercase tracking-wide mb-1">
            Ready for review
          </div>
          <div className="text-[15px] text-paper">
            Today's ad — Ethiopia Yirgacheffe, 15% off badge
          </div>
        </div>
        <button className="bg-safelight text-paper font-semibold text-[13px] rounded-md px-4.5 py-2.5 whitespace-nowrap hover:opacity-90 transition-opacity">
          Review &amp; approve
        </button>
      </div>

      {/* Schedule Next Post Card */}
      <div className="bg-ink-2 border border-hair rounded-xl overflow-hidden mb-8 p-6">
        <div className="mb-5">
          <h3 className="font-display font-semibold text-lg mb-1 text-paper">Schedule Next Post</h3>
          <p className="font-mono text-xs text-muted">Automatically publish at a specific date and time</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-[11px] text-muted uppercase tracking-wider mb-2.5">Select Date & Time</label>
            <div className="flex gap-3 mb-4">
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="flex-1 bg-ink-3 border border-hair text-paper font-mono text-[13px] px-3 py-2.5 rounded-lg focus:outline-none focus:border-safelight"
              />
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-32 bg-ink-3 border border-hair text-paper font-mono text-[13px] px-3 py-2.5 rounded-lg focus:outline-none focus:border-safelight"
              />
            </div>
          </div>

          {scheduleSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-emerald-400 text-sm font-mono">{scheduleSuccess}</p>
            </div>
          )}
          {scheduleError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm font-mono">{scheduleError}</p>
            </div>
          )}

          <button
            onClick={handleSchedulePost}
            disabled={scheduling || !scheduleDate || !scheduleTime}
            className="w-full bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {scheduling ? 'Scheduling…' : 'Schedule Post'}
          </button>
        </div>
      </div>

      <div className="flex justify-between items-end mb-6">
        <h3 className="font-display font-semibold text-base">Post history</h3>
        <span className="font-mono text-xs text-muted">
          {postedCount} {postedCount === 1 ? 'post' : 'posts'} published
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] bg-hair border border-hair rounded-xl overflow-hidden">
        {loadingHistory ? (
          <div className="bg-ink-2 aspect-square p-5 flex items-center justify-center col-span-full">
            <span className="font-mono text-xs text-muted animate-pulse">Loading post history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-ink-2 aspect-square p-5 flex items-center justify-center col-span-full">
            <span className="font-mono text-xs text-muted">No posts found</span>
          </div>
        ) : (
          history.map((post) => {
            const dateStr = post.postedAt || post.scheduledFor || post.createdAt;
            const formattedDate = dateStr
              ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : 'Unknown';

            const getStatusDotColor = (status) => {
              switch (status) {
                case 'pending': return 'bg-safelight animate-blink';
                case 'posted': return 'bg-gold';
                case 'rejected': return 'bg-red-500';
                default: return 'bg-zinc-500';
              }
            };

            return (
              <div key={post._id} className="bg-ink-2 aspect-square p-2.5 flex flex-col justify-between">
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt={formattedDate}
                    className="flex-1 rounded object-cover mb-1.5 min-h-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex-1 rounded bg-gradient-to-br from-zinc-700 to-zinc-900 mb-1.5" />
                )}
                <div className="flex justify-between items-center font-mono text-[10px] text-muted">
                  <span>{formattedDate}</span>
                  <span
                    title={post.status}
                    className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(post.status)}`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
