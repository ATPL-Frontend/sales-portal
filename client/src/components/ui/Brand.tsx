export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center text-white">
        <img src="/logo.jpg" alt="Ampec logo" className="h-10 square" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
          AMPEC
        </span>
        <span className="mt-0.5 text-[11px] font-medium tracking-wide text-slate-400">
          Sales portal
        </span>
      </span>
    </div>
  );
}
