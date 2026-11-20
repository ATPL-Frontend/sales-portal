import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm";
  children: ReactNode;
};

const variants = {
  primary:
    "bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-300",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-200",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-200",
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${size === "sm" ? "min-h-9 px-3" : "min-h-11 px-4"} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
