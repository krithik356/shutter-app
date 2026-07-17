import { useState } from 'react';
import { MOCK_CAPTION } from '../../data/mockData';

export default function Step6Caption({ onNext }) {
  const [caption, setCaption] = useState(MOCK_CAPTION.text);
  const [editing, setEditing] = useState(false);

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
        <div className="font-mono text-[13px] text-gold mt-3">{MOCK_CAPTION.hashtags}</div>
      </div>

      <div className="flex gap-3 mt-9">
        <button
          onClick={onNext}
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
