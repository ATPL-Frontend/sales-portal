import { Cable } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-slate-900 text-white">
        <Cable size={20} strokeWidth={2.1} />
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
