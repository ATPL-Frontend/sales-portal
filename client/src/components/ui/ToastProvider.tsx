import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastKind = "success" | "error" | "info";
type ToastEntry = { id: number; kind: ToastKind; message: string };
type ToastAPI = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};
const ToastContext = createContext<ToastAPI | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const timeouts = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timeouts.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timeouts.current.delete(id);
    setEntries((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++nextId.current;
      setEntries((previous) => [...previous.slice(-2), { id, kind, message }]);
      const timer = window.setTimeout(() => dismiss(id), 5000);
      timeouts.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      for (const timer of timeouts.current.values()) window.clearTimeout(timer);
      timeouts.current.clear();
    },
    [],
  );

  const toast = useMemo<ToastAPI>(
    () => ({
      success: (message) => show("success", message),
      error: (message) => show("error", message),
      info: (message) => show("info", message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-100 w-[min(24rem,calc(100vw-2rem))] space-y-3"
        aria-live="polite"
        aria-atomic="false"
      >
        {entries.map((entry) => {
          const Icon =
            entry.kind === "success"
              ? CheckCircle2
              : entry.kind === "error"
                ? CircleAlert
                : Info;
          return (
            <div
              key={entry.id}
              role={entry.kind === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-lg"
            >
              <Icon
                size={20}
                className={
                  entry.kind === "error"
                    ? "mt-0.5 shrink-0 text-red-500"
                    : "mt-0.5 shrink-0 text-slate-700"
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {entry.kind === "success"
                    ? "Success"
                    : entry.kind === "error"
                      ? "Error"
                      : "Notice"}
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {entry.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(entry.id)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
