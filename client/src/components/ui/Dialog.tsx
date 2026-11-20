import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Dialog({
  title,
  description,
  children,
  onClose,
  size = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  size?: "default" | "wide";
}) {
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full ${size === "wide" ? "max-w-4xl" : "max-w-lg"} overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-7`}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
