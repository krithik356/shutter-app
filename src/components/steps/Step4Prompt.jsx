import { useState } from 'react';
import { MOCK_CONCEPT } from '../../data/mockData';

export default function Step4Prompt({ onNext }) {
  const [prompt, setPrompt] = useState(MOCK_CONCEPT.prompt);

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 4 — The shot list
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Today's ad concept
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        This is the exact prompt we'll hand to the image generator. Nudge it if you want
        something different.
      </p>

      <div className="bg-ink-2 border border-hair rounded-xl p-7">
        <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-2.5">
          Concept
        </div>
        <p className="text-[14px] leading-relaxed text-secondary">
          <strong className="text-paper font-medium">Product highlight:</strong>{' '}
          {MOCK_CONCEPT.title.split(': ')[1]}
        </p>
      </div>

      <div className="bg-ink-2 border border-hair rounded-xl p-7 mt-4">
        <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-2.5">
          Image prompt
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full bg-ink-3 border border-hair rounded-lg p-4 text-paper font-mono text-[13px] leading-relaxed min-h-[120px] focus:outline-none focus:border-safelight resize-y"
        />
      </div>

      <div className="flex gap-3 mt-9">
        <button
          onClick={onNext}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity"
        >
          Generate images
        </button>
        <button className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors">
          Regenerate concept
        </button>
      </div>
    </div>
  );
}
