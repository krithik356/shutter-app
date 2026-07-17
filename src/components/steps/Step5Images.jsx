import { useState } from 'react';
import { MOCK_IMAGES } from '../../data/mockData';

export default function Step5Images({ onNext }) {
  const [selected, setSelected] = useState('a');

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 5 — Prints
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Pick your favorite
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        Three takes from the same prompt. Select one to move forward, or regenerate for
        new options.
      </p>

      <div className="grid grid-cols-3 gap-3.5">
        {MOCK_IMAGES.map((img) => (
          <div
            key={img.id}
            onClick={() => setSelected(img.id)}
            className={`rounded-xl overflow-hidden cursor-pointer border-2 transition-colors relative aspect-square bg-gradient-to-br ${img.gradient} ${
              selected === img.id ? 'border-safelight' : 'border-hair'
            }`}
          >
            <div className="w-full h-full flex items-center justify-center text-center p-4 font-mono text-[11px] text-muted leading-relaxed">
              {img.label}
              <br />
              variation {img.id.toUpperCase()}
            </div>
            {selected === img.id && (
              <span className="absolute top-2.5 right-2.5 w-5.5 h-5.5 rounded-full bg-safelight flex items-center justify-center text-[11px] text-paper w-6 h-6">
                ✓
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-9">
        <button
          onClick={onNext}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity"
        >
          Use this one
        </button>
        <button className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors">
          Regenerate all
        </button>
      </div>
    </div>
  );
}
