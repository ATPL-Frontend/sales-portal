import type { InputHTMLAttributes } from "react";

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50";

export function Field({
  label,
  id,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="flex items-center justify-between text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="font-normal text-slate-400">{hint}</span>}
      </span>
      <input id={id} className={`${inputClass} ${className}`} {...props} />
    </label>
  );
}
