export default function TopBar() {
  return (
    <div className="border-b border-hair py-5">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 font-display font-bold text-xl tracking-tight">
          <span className="w-2.5 h-2.5 rounded-full bg-safelight shadow-[0_0_8px_#D6402C]" />
          Shutter
          <span className="font-mono text-[11px] text-muted font-normal ml-1">/ ad automation</span>
        </div>
        <div className="font-mono text-xs text-muted">demo walkthrough</div>
      </div>
    </div>
  );
}
