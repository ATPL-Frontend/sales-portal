export function Notice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'success' | 'info' }) {
  const styles = { error: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-600 dark:bg-rose-950 dark:text-rose-200', success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900', info: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900' };
  return <div role="status" className={`rounded-xl border px-4 py-3 text-sm leading-6 ${styles[tone]}`}>{message}</div>;
}
