import { useWizard } from '../../context/WizardContext';

function Card({ label, children }) {
  return (
    <div className="bg-ink-2 border border-hair rounded-xl p-7 mt-4 first:mt-0">
      <div className="font-mono text-[11px] text-muted uppercase tracking-wider mb-2.5">
        {label}
      </div>
      {children}
    </div>
  );
}

export default function Step3BrandKit({ onNext }) {
  const { brandKit } = useWizard();

  // Guard — shouldn't reach here without a brand kit, but just in case
  if (!brandKit) {
    return (
      <div className="text-muted font-mono text-sm">
        No brand kit data available. Please go back and analyze a URL.
      </div>
    );
  }

  return (
    <div>
      <div className="font-mono text-xs text-safelight uppercase tracking-wider mb-3.5">
        Step 3 — Contact sheet
      </div>
      <h1 className="font-display font-semibold text-3xl md:text-4xl leading-tight mb-3">
        Here's what we found
      </h1>
      <p className="text-secondary text-[15px] leading-relaxed max-w-lg mb-10">
        This is your Brand Kit — everything downstream gets generated from it. Fix anything
        that's off.
      </p>

      <Card label="Brand colors">
        <div className="flex gap-2">
          {brandKit.colors?.map((c) => (
            <div key={c} className="w-9 h-9 rounded-md border border-hair" style={{ background: c }} />
          ))}
        </div>
      </Card>

      <Card label="Business summary">
        <p className="text-[14px] leading-relaxed text-secondary">
          <strong className="text-paper font-medium">{brandKit.businessName}</strong>
          {brandKit.summary?.includes('—') ? ` — ${brandKit.summary.split('—').slice(1).join('—').trim()}` : ` — ${brandKit.summary}`}
        </p>
      </Card>

      <Card label="Products detected">
        <div className="flex flex-wrap gap-2">
          {brandKit.products?.map((p) => (
            <span
              key={p}
              className="font-mono text-xs bg-ink-3 border border-hair text-secondary px-2.5 py-1.5 rounded-full"
            >
              {p}
            </span>
          ))}
        </div>
      </Card>

      {brandKit.tone && (
        <Card label="Tone of voice">
          <p className="text-[14px] leading-relaxed text-secondary">{brandKit.tone}</p>
        </Card>
      )}

      <div className="flex gap-3 mt-9">
        <button
          onClick={onNext}
          className="bg-safelight text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:opacity-90 transition-opacity"
        >
          Looks right, continue
        </button>
        {/* TODO: wire edit — open inline editing of the brand kit fields */}
        <button className="border border-hair text-paper font-semibold text-sm rounded-md px-6 py-3.5 hover:border-secondary transition-colors">
          Edit brand kit
        </button>
      </div>
    </div>
  );
}
