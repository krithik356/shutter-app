import { useEffect, useState } from 'react';
import { ANALYSIS_ITEMS } from '../../data/mockData';

export default function Step2Developing({ onDone }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (activeIdx >= ANALYSIS_ITEMS.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setActiveIdx((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [activeIdx, onDone]);

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 2 — Developing
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Reading northbrewcoffee.com
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        This usually takes under a minute. Here's what we're picking up on.
      </p>
      <div className="flex flex-col md:flex-row gap-10 items-start md:items-center">
        <div className="w-44 h-44 rounded-lg border border-hair relative overflow-hidden flex-shrink-0"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #1C1F24 0 2px, #24282F 2px 4px)',
          }}>
          <div className="absolute inset-0 bg-safelight animate-pulse-soft" />
        </div>
        <div className="flex flex-col gap-3.5 flex-1">
          {ANALYSIS_ITEMS.map((item, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <div
                key={item}
                className={`flex items-center gap-3 font-mono text-[13.5px] ${
                  done ? 'text-secondary' : active ? 'text-paper' : 'text-muted'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                    done ? 'bg-gold border-gold' : active ? 'border-safelight' : 'border-hair'
                  }`}
                >
                  {done && <span className="w-1.5 h-1.5 bg-ink rounded-full" />}
                  {active && <span className="w-1.5 h-1.5 bg-safelight rounded-full animate-blink" />}
                </span>
                {item}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
