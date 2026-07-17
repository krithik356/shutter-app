import { MOCK_HISTORY } from '../../data/mockData';

export default function Step8Dashboard() {
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

      <div className="flex justify-between items-end mb-6">
        <h3 className="font-display font-semibold text-base">Post history</h3>
        <span className="font-mono text-xs text-muted">12 posted this month</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[2px] bg-hair border border-hair rounded-xl overflow-hidden">
        {MOCK_HISTORY.map((post) => (
          <div key={post.date} className="bg-ink-2 aspect-square p-2.5 flex flex-col justify-between">
            <div className="flex-1 rounded bg-gradient-to-br from-zinc-700 to-zinc-900 mb-1.5" />
            <div className="flex justify-between items-center font-mono text-[10px] text-muted">
              <span>{post.date}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  post.status === 'pending' ? 'bg-safelight animate-blink' : 'bg-gold'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
