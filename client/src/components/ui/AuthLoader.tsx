import { LoaderCircle } from "lucide-react";

export function AuthLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="
        flex min-h-dvh w-full
        flex-col items-center justify-center
        bg-slate-50 px-4
      "
    >
      {/* Animated logo */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* Outer rotating ring */}
        <div
          className="
            absolute inset-0 rounded-full
            border-[3px] border-slate-200
            border-t-[#135D66]
            dark:border-[#29464B]
            dark:border-t-[#77B0AA]
            animate-spin
            motion-reduce:animate-none
          "
        />

        {/* Inner circle */}
        <div
          className="
            flex h-16 w-16 items-center justify-center
            rounded-full bg-white
            shadow-sm
          "
        >
          <span
            className="
              text-2xl font-bold tracking-tight
              text-slate-900
            "
          >
            A
          </span>
        </div>
      </div>

      {/* Branding */}
      <div className="mt-8 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          AMPEC
        </h1>

        <p className="mt-1 text-sm font-medium text-slate-500">Sales Portal</p>
      </div>

      {/* Loading status */}
      <div className="mt-8 flex items-center gap-2.5">
        <LoaderCircle
          size={15}
          className="
            animate-spin text-slate-500
            motion-reduce:animate-none
          "
        />

        <span className="text-xs font-medium text-slate-500">
          Checking your session...
        </span>
      </div>

      {/* Animated dots */}
      <div className="mt-5 flex items-center gap-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="
              h-1.5 w-1.5 rounded-full
              bg-[#77B0AA]
              animate-pulse
              motion-reduce:animate-none
            "
            style={{
              animationDelay: `${index * 200}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
