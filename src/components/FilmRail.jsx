import { STEP_LABELS } from '../data/mockData';

export default function FilmRail({ current, onJump, maxUnlocked }) {
  return (
    <div className="border-b border-hair bg-ink-2">
      <div className="flex gap-1.5 px-6 py-1.5 bg-ink-3 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className="w-1 h-1 rounded-[1px] bg-hair flex-shrink-0" />
        ))}
      </div>
      <div className="max-w-4xl mx-auto px-6 overflow-x-auto">
        <div className="flex min-w-max">
          {STEP_LABELS.map((s, i) => {
            const step = i + 1;
            const isActive = step === current;
            const isDone = step < current;
            const clickable = step <= maxUnlocked;
            return (
              <button
                key={s.n}
                disabled={!clickable}
                onClick={() => clickable && onJump(step)}
                className={`relative flex items-center gap-2 px-4 py-3.5 border-r border-hair last:border-r-0 whitespace-nowrap font-mono text-[11px] transition-colors
                  ${clickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                  ${isActive ? 'text-safelight' : isDone ? 'text-secondary' : 'text-muted'}`}
              >
                <span className={isDone ? 'text-gold' : ''}>{s.n}</span>
                <span>{s.l}</span>
                {isActive && (
                  <span className="absolute -bottom-[1px] left-4 right-4 h-0.5 bg-safelight" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
