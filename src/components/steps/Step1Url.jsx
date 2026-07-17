import { useState } from 'react';

export default function Step1Url({ onNext }) {
  const [url, setUrl] = useState('www.northbrewcoffee.com');

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 1 — Frame it
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3 max-w-xl">
        What's the business we're shooting for?
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        Paste your website URL. We'll read it, learn how you talk about your business,
        and start developing your first ad.
      </p>
      <div className="flex gap-2.5 max-w-lg">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="www.yourbusiness.com"
          className="flex-1 bg-ink-2 border border-hair rounded-md px-4 py-4 font-mono text-sm text-paper placeholder:text-muted focus:outline-none focus:border-safelight"
        />
        <button
          onClick={onNext}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-4 whitespace-nowrap hover:opacity-90 transition-opacity"
        >
          Analyze site
        </button>
      </div>
    </div>
  );
}
