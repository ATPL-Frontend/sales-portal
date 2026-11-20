import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
