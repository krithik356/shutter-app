import { useState } from 'react';

export default function Step7Connect({ onNext }) {
  const [time, setTime] = useState('9:00 AM');
  const [autoApprove, setAutoApprove] = useState(false);

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
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-safelight to-gold flex-shrink-0" />
            <div>
              <h3 className="font-display font-semibold text-base mb-0.5">Instagram</h3>
              <div className="font-mono text-xs text-muted">@northbrewcoffee</div>
            </div>
          </div>
          <span className="font-mono text-[11px] text-gold border border-gold px-2.5 py-1 rounded-full">
            Connected
          </span>
        </div>
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
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity"
        >
          Start daily automation
        </button>
      </div>
    </div>
  );
}
